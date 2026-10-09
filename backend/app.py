import csv
import io
import os
from datetime import datetime
from functools import wraps
from pathlib import Path

import mysql.connector
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_socketio import SocketIO
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "static" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "edabip-development-secret-change-me")
CORS(app, supports_credentials=True)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "Sql@12345"),
    "database": os.getenv("DB_NAME", "edabip_mini"),
}

ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
MAX_AVATAR_BYTES = 2 * 1024 * 1024


def db():
    return mysql.connector.connect(**DB_CONFIG)


def query(sql, params=(), fetch=True, many=False):
    conn = db()
    cur = conn.cursor(dictionary=True)
    try:
        if many:
            cur.executemany(sql, params)
        else:
            cur.execute(sql, params)
        result = cur.fetchall() if fetch else None
        conn.commit()
        return result
    finally:
        cur.close()
        conn.close()


def current_user():
    return int(get_jwt_identity())


def get_user(user_id=None):
    uid = user_id or current_user()
    rows = query(
        "SELECT id,name,email,role,avatar_url,created_at FROM users WHERE id=%s",
        (uid,),
    )
    return rows[0] if rows else None


def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            user = get_user()
            if not user:
                return jsonify({"message": "User account not found"}), 401
            if user["role"] not in roles:
                return jsonify({"message": "Insufficient permissions"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def log_action(user_id, action):
    query(
        "INSERT INTO activity_log(user_id,action) VALUES(%s,%s)",
        (user_id, action),
        fetch=False,
    )
    user = get_user(user_id)
    socketio.emit(
        "activity_update",
        {
            "user": user_id,
            "user_name": user["name"] if user else "Platform",
            "role": user["role"] if user else "system",
            "action": action,
            "created_at": datetime.utcnow().isoformat() + "Z",
        },
    )


@app.get("/api/health")
def health():
    try:
        query("SELECT 1")
        return jsonify({"status": "ok", "database": "connected", "app": "EDABIP Analytics"})
    except Exception as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500


@app.post("/api/register")
def register():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    if not name or "@" not in email or len(password) < 6:
        return jsonify({"message": "Name, valid email and password of at least 6 characters are required"}), 400
    if query("SELECT id FROM users WHERE email=%s", (email,)):
        return jsonify({"message": "Email already registered"}), 409
    hashed = bcrypt.generate_password_hash(password).decode()
    query(
        "INSERT INTO users(name,email,password,role) VALUES(%s,%s,%s,'viewer')",
        (name, email, hashed),
        fetch=False,
    )
    return jsonify({"message": "Account created successfully"}), 201


@app.post("/api/login")
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    user_rows = query(
        "SELECT id,name,email,password,role,avatar_url FROM users WHERE email=%s",
        (email,),
    )
    if not user_rows or not bcrypt.check_password_hash(user_rows[0]["password"], password):
        return jsonify({"message": "Invalid email or password"}), 401

    u = user_rows[0]
    token = create_access_token(identity=str(u["id"]))
    return jsonify(
        {
            "token": token,
            "user": {
                "id": u["id"],
                "name": u["name"],
                "email": u["email"],
                "role": u["role"],
                "avatar_url": u["avatar_url"],
            },
        }
    )


@app.get("/api/logout")
@jwt_required()
def logout():
    return jsonify({"message": "Logout acknowledged. Clear the client session to finish signing out."})


@app.get("/api/me")
@jwt_required()
def me():
    user = get_user()
    return jsonify(user) if user else (jsonify({"message": "User not found"}), 404)


@app.put("/api/me")
@jwt_required()
def update_me():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"message": "Name is required"}), 400
    query("UPDATE users SET name=%s WHERE id=%s", (name, current_user()), fetch=False)
    return jsonify({"message": "Profile updated successfully", "user": get_user()})


@app.put("/api/me/password")
@jwt_required()
def change_password():
    data = request.get_json() or {}
    current = data.get("current_password", "")
    new_password = data.get("new_password", "")
    if len(new_password) < 6:
        return jsonify({"message": "New password must contain at least 6 characters"}), 400

    rows = query("SELECT password FROM users WHERE id=%s", (current_user(),))
    if not rows or not bcrypt.check_password_hash(rows[0]["password"], current):
        return jsonify({"message": "Current password is incorrect"}), 400

    hashed = bcrypt.generate_password_hash(new_password).decode()
    query("UPDATE users SET password=%s WHERE id=%s", (hashed, current_user()), fetch=False)
    log_action(current_user(), "Changed account password")
    return jsonify({"message": "Password changed successfully"})


@app.post("/api/me/avatar")
@jwt_required()
def upload_avatar():
    image = request.files.get("avatar")
    if not image or not image.filename:
        return jsonify({"message": "Please choose an image"}), 400

    ext = image.filename.rsplit(".", 1)[-1].lower() if "." in image.filename else ""
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return jsonify({"message": "Avatar must be PNG, JPG, JPEG or WEBP"}), 400

    image.stream.seek(0, os.SEEK_END)
    size = image.stream.tell()
    image.stream.seek(0)
    if size > MAX_AVATAR_BYTES:
        return jsonify({"message": "Avatar must be smaller than 2 MB"}), 400

    filename = f"user_{current_user()}_{int(datetime.utcnow().timestamp())}.{ext}"
    image.save(UPLOAD_DIR / secure_filename(filename))
    avatar_url = f"/static/uploads/{filename}"
    query("UPDATE users SET avatar_url=%s WHERE id=%s", (avatar_url, current_user()), fetch=False)
    log_action(current_user(), "Updated profile avatar")
    return jsonify({"message": "Avatar updated successfully", "avatar_url": avatar_url})


@app.get("/api/departments")
@jwt_required()
def departments():
    return jsonify(query("SELECT id,name FROM departments ORDER BY name"))


def filters():
    department = request.args.get("department", "").strip()
    from_d = request.args.get("from", "").strip()
    to_d = request.args.get("to", "").strip()
    where, params = [], []

    if department:
        where.append("d.name=%s")
        params.append(department)
    if from_d:
        where.append("m.recorded_on >= %s")
        params.append(from_d)
    if to_d:
        where.append("m.recorded_on <= %s")
        params.append(to_d)

    return (" WHERE " + " AND ".join(where)) if where else "", params


@app.get("/api/kpis")
@jwt_required()
def kpis():
    w, p = filters()
    total = query(
        f"""SELECT COALESCE(SUM(m.metric_value),0) total, COUNT(*) records
            FROM metrics m JOIN departments d ON d.id=m.department_id{w}""",
        tuple(p),
    )[0]

    active = query(
        f"""SELECT d.name,COUNT(*) c
            FROM metrics m JOIN departments d ON d.id=m.department_id{w}
            GROUP BY d.id ORDER BY c DESC LIMIT 1""",
        tuple(p),
    )

    # Month-on-month uses the selected department, while date bounds remain a
    # view filter for the other KPIs/charts.
    department = request.args.get("department", "").strip()
    dep_clause = " JOIN departments d ON d.id=m.department_id"
    dep_filter = " AND d.name=%s" if department else ""
    dep_param = (department,) if department else ()

    current = query(
        f"""SELECT COALESCE(SUM(m.metric_value),0) v
            FROM metrics m{dep_clause}
            WHERE m.recorded_on>=DATE_FORMAT(CURDATE(),'%Y-%m-01'){dep_filter}""",
        dep_param,
    )[0]["v"]

    previous = query(
        f"""SELECT COALESCE(SUM(m.metric_value),0) v
            FROM metrics m{dep_clause}
            WHERE m.recorded_on>=DATE_FORMAT(DATE_SUB(CURDATE(),INTERVAL 1 MONTH),'%Y-%m-01')
              AND m.recorded_on<DATE_FORMAT(CURDATE(),'%Y-%m-01'){dep_filter}""",
        dep_param,
    )[0]["v"]

    change = 0 if not previous else round((float(current) - float(previous)) / float(previous) * 100, 2)
    return jsonify(
        {
            "total_value": float(total["total"]),
            "records": total["records"],
            "active_department": active[0]["name"] if active else "—",
            "mom_change": change,
        }
    )


@app.get("/api/metrics/trend")
@jwt_required()
def trend():
    w, p = filters()
    metric = request.args.get("metric_name", "").strip()
    if metric:
        w += (" AND " if w else " WHERE ") + "m.metric_name=%s"
        p.append(metric)

    rows = query(
        f"""SELECT DATE_FORMAT(m.recorded_on,'%Y-%m') month,
                   ROUND(SUM(m.metric_value),2) value
            FROM metrics m JOIN departments d ON d.id=m.department_id{w}
            GROUP BY month ORDER BY month""",
        tuple(p),
    )
    return jsonify(rows)


@app.get("/api/metrics/by-department")
@jwt_required()
def by_department():
    w, p = filters()
    return jsonify(
        query(
            f"""SELECT d.name,ROUND(SUM(m.metric_value),2) value
                FROM metrics m JOIN departments d ON d.id=m.department_id{w}
                GROUP BY d.id ORDER BY value DESC""",
            tuple(p),
        )
    )


@app.get("/api/metrics/top")
@jwt_required()
def top_metrics():
    w, p = filters()
    return jsonify(
        query(
            f"""SELECT m.metric_name name,ROUND(SUM(m.metric_value),2) value,COUNT(*) records
                FROM metrics m JOIN departments d ON d.id=m.department_id{w}
                GROUP BY m.metric_name ORDER BY value DESC LIMIT 5""",
            tuple(p),
        )
    )


@app.get("/api/metrics")
@jwt_required()
def metrics():
    w, p = filters()
    search = request.args.get("search", "").strip()
    if search:
        w += (" AND " if w else " WHERE ") + "m.metric_name LIKE %s"
        p.append(f"%{search}%")

    try:
        page = max(int(request.args.get("page", 1)), 1)
        limit = min(max(int(request.args.get("limit", 10)), 1), 100)
    except ValueError:
        return jsonify({"message": "Invalid pagination parameters"}), 400

    count = query(
        f"SELECT COUNT(*) c FROM metrics m JOIN departments d ON d.id=m.department_id{w}",
        tuple(p),
    )[0]["c"]

    rows = query(
        f"""SELECT m.id,d.name department,m.metric_name,m.metric_value,
                   m.recorded_on,u.name uploaded_by
            FROM metrics m
            JOIN departments d ON d.id=m.department_id
            JOIN users u ON u.id=m.uploaded_by
            {w}
            ORDER BY m.recorded_on DESC,m.id DESC
            LIMIT %s OFFSET %s""",
        tuple(p + [limit, (page - 1) * limit]),
    )
    return jsonify(
        {
            "data": rows,
            "page": page,
            "limit": limit,
            "total": count,
            "pages": (count + limit - 1) // limit,
        }
    )


@app.post("/api/metrics")
@role_required("admin", "analyst")
def add_metric():
    data = request.get_json() or {}
    try:
        metric_name = data["metric_name"].strip()
        if not metric_name:
            raise ValueError("Metric name is required")
        value = float(data["metric_value"])
        if value < 0:
            raise ValueError("Metric value cannot be negative")
        dep_rows = query("SELECT id FROM departments WHERE name=%s", (data["department"],))
        if not dep_rows:
            raise ValueError("Unknown department")

        query(
            """INSERT INTO metrics(department_id,metric_name,metric_value,recorded_on,uploaded_by)
               VALUES(%s,%s,%s,%s,%s)""",
            (dep_rows[0]["id"], metric_name, value, data["recorded_on"], current_user()),
            fetch=False,
        )
        log_action(current_user(), f"Added metric '{metric_name}'")
        return jsonify({"message": "Metric added successfully"}), 201
    except (KeyError, ValueError, TypeError):
        return jsonify({"message": "Please provide valid department, metric name, value and date"}), 400


@app.post("/api/metrics/upload")
@role_required("admin", "analyst")
def upload():
    file = request.files.get("file")
    if not file or not file.filename.lower().endswith(".csv"):
        return jsonify({"message": "Please upload a CSV file"}), 400

    try:
        text = file.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        return jsonify({"message": "CSV must be UTF-8 encoded"}), 400

    reader = csv.DictReader(io.StringIO(text))
    required = {"department", "metric_name", "metric_value", "recorded_on"}
    headers = {h.strip() for h in (reader.fieldnames or [])}
    if not required.issubset(headers):
        return jsonify({"message": "CSV must contain: department, metric_name, metric_value, recorded_on"}), 400

    departments_map = {r["name"]: r["id"] for r in query("SELECT id,name FROM departments")}
    rows, errors = [], []

    for number, raw in enumerate(reader, start=2):
        try:
            r = {str(k).strip(): (v or "").strip() for k, v in raw.items() if k}
            department_id = departments_map.get(r.get("department", ""))
            metric_name = r.get("metric_name", "")
            value = float(r.get("metric_value", ""))
            recorded_on = r.get("recorded_on", "")

            if not department_id:
                raise ValueError("unknown department")
            if not metric_name:
                raise ValueError("metric name is empty")
            if value < 0:
                raise ValueError("metric value cannot be negative")
            datetime.strptime(recorded_on, "%Y-%m-%d")

            rows.append((department_id, metric_name, value, recorded_on, current_user()))
        except Exception as exc:
            errors.append(f"Row {number}: {exc}")

    if errors:
        return jsonify({"message": "CSV validation failed", "errors": errors[:10]}), 400
    if not rows:
        return jsonify({"message": "CSV contains no data rows"}), 400

    query(
        """INSERT INTO metrics(department_id,metric_name,metric_value,recorded_on,uploaded_by)
           VALUES(%s,%s,%s,%s,%s)""",
        rows,
        fetch=False,
        many=True,
    )
    log_action(current_user(), f"Uploaded {len(rows)} metric records")
    return jsonify({"message": f"{len(rows)} records uploaded successfully", "count": len(rows)})


@app.delete("/api/metrics/<int:metric_id>")
@role_required("admin")
def delete_metric(metric_id):
    existing = query("SELECT id FROM metrics WHERE id=%s", (metric_id,))
    if not existing:
        return jsonify({"message": "Metric not found"}), 404
    query("DELETE FROM metrics WHERE id=%s", (metric_id,), fetch=False)
    log_action(current_user(), f"Deleted metric #{metric_id}")
    return jsonify({"message": "Metric deleted successfully"})


@app.get("/api/activity")
@role_required("admin")
def activity():
    return jsonify(
        query(
            """SELECT a.id,u.name user_name,u.role,a.action,a.created_at
               FROM activity_log a JOIN users u ON u.id=a.user_id
               ORDER BY a.created_at DESC LIMIT 20"""
        )
    )


@app.route("/static/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename)


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)

from app import db, bcrypt

def run():
    conn = db()
    cur = conn.cursor()

    # Migrate the credentials used by the first local build to clean EDABIP names.
    migrations = [
        ("admin@nexora.local", "admin@edabip.local"),
        ("analyst@nexora.local", "analyst@edabip.local"),
        ("viewer@nexora.local", "viewer@edabip.local"),
    ]
    for old_email, new_email in migrations:
        cur.execute("UPDATE users SET email=%s WHERE email=%s", (new_email, old_email))

    users = [
        ("EDABIP Admin", "admin@edabip.local", bcrypt.generate_password_hash("Admin@123").decode(), "admin"),
        ("Priya Analyst", "analyst@edabip.local", bcrypt.generate_password_hash("Analyst@123").decode(), "analyst"),
        ("Demo Viewer", "viewer@edabip.local", bcrypt.generate_password_hash("Viewer@123").decode(), "viewer"),
    ]
    for user in users:
        cur.execute(
            "INSERT IGNORE INTO users(name,email,password,role) VALUES(%s,%s,%s,%s)",
            user,
        )

    cur.execute("SELECT id FROM departments ORDER BY id")
    departments = cur.fetchall()

    cur.execute("SELECT id FROM users WHERE email='admin@edabip.local'")
    admin_row = cur.fetchone()
    if not admin_row:
        raise RuntimeError("Could not create the EDABIP admin account.")
    admin_id = admin_row[0]

    cur.execute("SELECT COUNT(*) FROM metrics")
    existing = cur.fetchone()[0]

    if existing < 200:
        import random
        from datetime import date

        metric_names = [
            "Revenue", "Orders", "Leads", "Conversions",
            "Customer Retention", "Operating Cost", "Productivity",
            "Tickets Resolved"
        ]
        rows = []
        for month_offset in range(12):
            year = 2026
            month = 10 - month_offset
            if month <= 0:
                year -= 1
                month += 12

            for dep_id, in departments:
                for _ in range(4):
                    rows.append((
                        dep_id,
                        random.choice(metric_names),
                        round(random.uniform(1200, 95000), 2),
                        date(year, month, random.randint(1, 28)),
                        admin_id,
                    ))

        cur.executemany(
            """INSERT INTO metrics(department_id,metric_name,metric_value,recorded_on,uploaded_by)
               VALUES(%s,%s,%s,%s,%s)""",
            rows,
        )

    conn.commit()
    cur.close()
    conn.close()

    print("EDABIP seed complete.")
    print("Admin: admin@edabip.local / Admin@123")
    print("Analyst: analyst@edabip.local / Analyst@123")
    print("Viewer: viewer@edabip.local / Viewer@123")

if __name__ == "__main__":
    run()

# EDABIP — Enterprise Data Analytics & Business Intelligence Dashboard

## Task 20 — Full Stack Capstone
React + Flask + MySQL

This repository implements the supplied Task 20 specification.

### Stack
- React + Vite
- React Router
- Axios
- Recharts
- Context API
- Custom hooks
- Flask
- Flask-JWT-Extended
- Flask-Bcrypt
- Flask-CORS
- Flask-SocketIO
- MySQL

### MySQL
Database: `edabip_mini`

Local development password configured in the backend:
`Sql@12345`

For production, move the password to environment variables.

### Setup

#### 1. MySQL
Run `backend/schema.sql` in MySQL Workbench.

#### 2. Backend
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python seed.py
python app.py
```

API: http://localhost:5000

#### 3. Frontend
Open a second terminal:
```powershell
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

### Test credentials
Admin:
`admin@nexora.local` / `Admin@123`

Analyst:
`analyst@nexora.local` / `Analyst@123`

Viewer:
`viewer@nexora.local` / `Viewer@123`

### CSV format
```csv
department,metric_name,metric_value,recorded_on
Sales,Revenue,45000,2026-10-01
Marketing,Leads,1250,2026-10-02
Finance,Operating Cost,21000,2026-10-03
HR,Productivity,8900,2026-10-04
Operations,Tickets Resolved,7600,2026-10-05
```

### Required flow
Admin login → Dashboard → filters/charts → Data Management → CSV upload → activity update → KPI refresh → dark mode → logout → Viewer login → 403 on Data Management.

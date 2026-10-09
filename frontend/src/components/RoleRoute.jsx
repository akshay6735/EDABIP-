import { Navigate } from "react-router-dom";

export default function RoleRoute({ allowed = [], user, children }) {
  return allowed.includes(user?.role) ? children : <Navigate to="/403" replace />;
}

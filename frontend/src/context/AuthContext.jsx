import { createContext, useContext, useState } from "react";
import { api } from "../api";

const C = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("edabip_user")); }
    catch { return null; }
  });

  const login = async (email, password) => {
    const { data } = await api.post("/login", { email, password });
    localStorage.setItem("edabip_token", data.token);
    localStorage.setItem("edabip_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const refreshUser = async () => {
    const { data } = await api.get("/me");
    localStorage.setItem("edabip_user", JSON.stringify(data));
    setUser(data);
    return data;
  };

  const logout = async () => {
    try {
      if (localStorage.getItem("edabip_token")) await api.get("/logout");
    } catch {}
    localStorage.removeItem("edabip_token");
    localStorage.removeItem("edabip_user");
    setUser(null);
  };

  return <C.Provider value={{ user, login, logout, refreshUser }}>{children}</C.Provider>;
}
export const useAuth = () => useContext(C);

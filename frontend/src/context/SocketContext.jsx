import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [activities, setActivities] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io("http://localhost:5000", { transports: ["websocket", "polling"] });
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("activity_update", item => {
      setActivities(current => [item, ...current].slice(0, 20));
    });
    return () => socket.disconnect();
  }, []);

  return <SocketContext.Provider value={{ activities, setActivities, connected }}>{children}</SocketContext.Provider>;
}
export const useSocket = () => useContext(SocketContext);

import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

function relativeTime(value) {
  if (!value) return "Just now";
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) === 1 ? "" : "s"} ago`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const { activities } = useSocket() || { activities: [] };
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState([]);
  const ref = useRef();

  useEffect(() => {
    if (user?.role !== "admin") return;
    api.get("/activity").then(r => setRecent(r.data)).catch(() => {});
  }, [user?.role, activities.length]);

  useEffect(() => {
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const items = [...activities, ...recent].filter((item, index, all) =>
    index === all.findIndex(x => `${x.id || ""}-${x.action}-${x.created_at}` === `${item.id || ""}-${item.action}-${item.created_at}`)
  ).slice(0, 8);

  return <div className="notification-wrap" ref={ref}>
    <button className="notification-btn" title="Live activity" onClick={() => setOpen(v => !v)}>
      <span className="bell-icon">◌</span>{items.length > 0 && <b>{Math.min(items.length, 9)}</b>}
    </button>
    {open && <div className="notification-popover">
      <div className="notification-head"><div><strong>Live activity</strong><small>Latest workspace events</small></div><span>{items.length}</span></div>
      {items.length ? items.map((item, i) => <div className="notification-item" key={`${item.id || "live"}-${i}`}><i/><div><strong>{item.user_name || "Platform"}</strong><p>{item.action}</p><small>{relativeTime(item.created_at)}</small></div></div>) : <div className="notification-empty">No recent activity yet.</div>}
    </div>}
  </div>;
}

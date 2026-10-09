export default function ToastContainer({ toast }) {
  if (!toast) return null;
  return <div className={`notice ${toast.type === "error" ? "failure" : "success"}`} role="status">
    <span>{toast.type === "error" ? "!" : "✓"}</span>{toast.message}
  </div>;
}

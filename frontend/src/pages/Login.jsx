import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("admin@edabip.local");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const submit = async (e) => { e.preventDefault(); setError(""); try { await login(email, password); navigate("/dashboard"); } catch (err) { setError(err.response?.data?.message || "Unable to sign in. Check your credentials."); } };
  return <main className="login-page">
    <div className="login-art">
      <div className="art-grid"/><div className="orb orb-one"/><div className="orb orb-two"/>
      <div className="login-brand"><span>E</span><strong>EDABIP</strong></div>
      <div className="art-copy"><span className="eyebrow">ENTERPRISE DATA INTELLIGENCE</span><h1>Turn scattered numbers into <em>clear decisions.</em></h1><p>A focused analytics workspace for the teams that need to see the signal before everyone else does.</p></div>
      <div className="signal-card"><div className="signal-card-head"><span>LIVE SIGNAL</span><i/></div><strong>+15.69%</strong><small>month-on-month movement</small><div className="mini-wave"><span/><span/><span/><span/><span/><span/><span/><span/></div></div>
    </div>
    <div className="login-form-side"><div className="login-form-wrap"><div className="mobile-brand"><span>E</span> EDABIP</div><span className="eyebrow">SECURE WORKSPACE</span><h2>Welcome back.</h2><p>Sign in to continue to your intelligence workspace.</p>{error && <div className="error">{error}</div>}<form onSubmit={submit}><label>Work email<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="username"/></label><label>Password<div className="password-wrap"><input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="current-password"/><span>•••</span></div></label><button className="primary login-button">Enter workspace <span>→</span></button></form><div className="demo-box"><div><span>Demo access</span><strong>Administrator</strong></div><small>Use the seeded credentials supplied with Task 20.</small></div><footer>EDABIP • Built for enterprise analytics</footer></div></div>
  </main>;
}

import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import useToast from "../hooks/useToast";
import ToastContainer from "../components/ToastContainer";

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [name,setName] = useState(user?.name || "");
  const [currentPassword,setCurrentPassword] = useState("");
  const [newPassword,setNewPassword] = useState("");
  const [avatarPreview,setAvatarPreview] = useState(user?.avatar_url ? `http://localhost:5000${user.avatar_url}` : "");
  const fileRef = useRef();
  const { toast, show } = useToast();

  useEffect(() => {
    api.get("/me").then(r => {
      setName(r.data.name);
      if (r.data.avatar_url) setAvatarPreview(`http://localhost:5000${r.data.avatar_url}`);
    }).catch(() => show("Could not load your profile.","error"));
  }, []);

  const saveName = async e => {
    e.preventDefault();
    try {
      await api.put("/me",{name});
      await refreshUser();
      show("Profile details updated.");
    } catch (e) { show(e.response?.data?.message || "Could not update profile.","error"); }
  };

  const changePassword = async e => {
    e.preventDefault();
    try {
      await api.put("/me/password",{current_password:currentPassword,new_password:newPassword});
      setCurrentPassword("");
      setNewPassword("");
      show("Password changed successfully.");
    } catch (e) { show(e.response?.data?.message || "Could not change password.","error"); }
  };

  const uploadAvatar = async e => {
    const file=e.target.files?.[0];
    if(!file) return;
    const local=URL.createObjectURL(file);
    setAvatarPreview(local);
    const fd=new FormData();
    fd.append("avatar",file);
    try {
      await api.post("/me/avatar",fd);
      await refreshUser();
      show("Profile avatar updated.");
    } catch (e) {
      setAvatarPreview(user?.avatar_url ? `http://localhost:5000${user.avatar_url}` : "");
      show(e.response?.data?.message || "Could not upload avatar.","error");
    } finally { e.target.value=""; }
  };

  return <div className="page profile-page">
    <ToastContainer toast={toast}/>
    <section className="page-intro"><div><span className="eyebrow">ACCOUNT CENTRE</span><h1>Your identity layer.</h1><p>Keep your workspace profile current and recognizable across EDABIP.</p></div></section>
    <div className="profile-layout">
      <article className="profile-card panel">
        <div className="profile-cover"><div className="profile-avatar">{avatarPreview ? <img src={avatarPreview} alt="Profile avatar"/> : (name?.[0]||"E")}</div><button className="avatar-edit" onClick={()=>fileRef.current?.click()} title="Upload avatar">+</button></div>
        <div className="profile-body">
          <span className="badge">{user?.role}</span><h2>{name}</h2><p>{user?.email}</p>
          <div className="profile-facts"><div><small>ROLE</small><strong>{user?.role}</strong></div><div><small>WORKSPACE</small><strong>EDABIP</strong></div></div>
          <input ref={fileRef} className="hidden-file" type="file" accept=".png,.jpg,.jpeg,.webp" onChange={uploadAvatar}/>
        </div>
      </article>

      <div className="profile-settings">
        <article className="panel profile-form">
          <div className="panel-header"><div><span>PROFILE SETTINGS</span><h2>Update details</h2></div></div>
          <form onSubmit={saveName}>
            <label>Display name<input value={name} onChange={e=>setName(e.target.value)} required/></label>
            <label>Work email<input value={user?.email||""} disabled/></label>
            <button className="primary">Save changes <span>→</span></button>
          </form>
        </article>

        <article className="panel profile-form security-panel">
          <div className="panel-header"><div><span>SECURITY</span><h2>Change password</h2></div></div>
          <form onSubmit={changePassword}>
            <label>Current password<input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required autoComplete="current-password"/></label>
            <label>New password<input type="password" minLength="6" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required autoComplete="new-password"/></label>
            <button className="primary">Update password <span>→</span></button>
          </form>
          <div className="security-note"><strong>Protected account</strong><p>Your password is stored as a bcrypt hash. Never share your workspace credentials.</p></div>
        </article>
      </div>
    </div>
  </div>;
}

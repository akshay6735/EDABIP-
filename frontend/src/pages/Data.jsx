import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import useDebounce from "../hooks/useDebounce";
import useForm from "../hooks/useForm";
import useToast from "../hooks/useToast";
import ToastContainer from "../components/ToastContainer";

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += char;
  }
  values.push(value.trim());
  return values;
}

export default function Data() {
  const { user } = useAuth();
  const [deps,setDeps] = useState([]);
  const [rows,setRows] = useState([]);
  const [total,setTotal] = useState(0);
  const [page,setPage] = useState(1);
  const [pages,setPages] = useState(1);
  const [search,setSearch] = useState("");
  const [filters,setFilters] = useState({department:"",from:"",to:""});
  const [preview,setPreview] = useState([]);
  const [file,setFile] = useState(null);
  const [uploading,setUploading] = useState(false);
  const fileRef = useRef();
  const debouncedSearch = useDebounce(search, 350);
  const { values: form, set: setForm, reset: resetForm } = useForm({
    department:"Sales",
    metric_name:"Revenue",
    metric_value:"",
    recorded_on:new Date().toISOString().slice(0,10)
  });
  const { toast, show } = useToast();

  const load = () => api.get("/metrics", { params:{page,limit:10,search:debouncedSearch,...filters} })
    .then(r => { setRows(r.data.data); setPages(r.data.pages || 1); setTotal(r.data.total || 0); })
    .catch(() => show("Could not load the metric ledger.","error"));

  useEffect(() => { api.get("/departments").then(r=>setDeps(r.data)).catch(()=>show("Could not load departments.","error")); }, []);
  useEffect(() => { load(); }, [page,debouncedSearch,filters.department,filters.from,filters.to]);

  const add = async e => {
    e.preventDefault();
    try {
      await api.post("/metrics",form);
      show("Metric added successfully.");
      resetForm();
      setForm("department", deps[0]?.name || "Sales");
      load();
    } catch (e) {
      show(e.response?.data?.message || "Could not add record.","error");
    }
  };

  const readCsv = selected => {
    setFile(selected || null);
    setPreview([]);
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".csv")) {
      show("Please choose a .csv file.","error");
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const lines = String(e.target.result || "").replace(/^\uFEFF/,"").trim().split(/\r?\n/);
      if (!lines.length || !lines[0]) {
        show("The CSV file is empty.","error");
        return;
      }
      const parsed = lines.slice(0,6).map(parseCsvLine);
      const required = ["department","metric_name","metric_value","recorded_on"];
      const headers = parsed[0].map(v=>v.toLowerCase());
      const valid = required.every(h=>headers.includes(h));
      if (!valid) {
        show("CSV headers must be: department, metric_name, metric_value, recorded_on","error");
        setPreview([]);
        return;
      }
      setPreview(parsed);
    };
    reader.readAsText(selected);
  };

  const upload = async () => {
    if (!file || !preview.length) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file",file);
    try {
      const r = await api.post("/metrics/upload",fd);
      show(r.data.message);
      setFile(null);
      setPreview([]);
      if (fileRef.current) fileRef.current.value="";
      setPage(1);
      load();
    } catch (e) {
      const detail = e.response?.data?.errors?.slice(0,3)?.join(" • ");
      show(detail || e.response?.data?.message || "Upload failed.","error");
    } finally { setUploading(false); }
  };

  const remove = async id => {
    if (!window.confirm(`Delete metric #${id}?`)) return;
    try {
      await api.delete(`/metrics/${id}`);
      show("Metric deleted successfully.");
      load();
    } catch (e) {
      show(e.response?.data?.message || "Delete failed.","error");
    }
  };

  if (!["admin","analyst"].includes(user?.role)) {
    return <div className="page"><div className="empty-state"><div>403</div><h1>Restricted workspace</h1><p>Your role is read-only. Data Studio is available to Admin and Analyst users.</p></div></div>;
  }

  return <div className="page data-page">
    <ToastContainer toast={toast}/>
    <section className="page-intro"><div><span className="eyebrow">DATA STUDIO</span><h1>Shape the dataset.</h1><p>Add trusted records, upload a batch and keep the intelligence layer clean.</p></div><div className="dataset-status"><i/> {total.toLocaleString("en-IN")} matching records</div></section>

    <section className="studio-grid">
      <article className="panel form-panel">
        <div className="panel-header"><div><span>MANUAL ENTRY</span><h2>Add one signal</h2></div><b>1 record</b></div>
        <form className="signal-form" onSubmit={add}>
          <label>Department<select value={form.department} onChange={e=>setForm("department",e.target.value)}>{deps.map(d=><option key={d.id}>{d.name}</option>)}</select></label>
          <label>Metric name<input value={form.metric_name} onChange={e=>setForm("metric_name",e.target.value)} placeholder="e.g. Revenue" required/></label>
          <div className="form-two">
            <label>Value<input type="number" min="0" step="0.01" value={form.metric_value} onChange={e=>setForm("metric_value",e.target.value)} placeholder="0.00" required/></label>
            <label>Recorded on<input type="date" value={form.recorded_on} onChange={e=>setForm("recorded_on",e.target.value)} required/></label>
          </div>
          <button className="primary">Add to intelligence layer <span>→</span></button>
        </form>
      </article>

      <article className="panel upload-panel">
        <div className="panel-header"><div><span>BATCH IMPORT</span><h2>Drop in a CSV</h2></div><b>Bulk</b></div>
        <div className="upload-zone" onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();readCsv(e.dataTransfer.files?.[0])}}>
          <input ref={fileRef} type="file" accept=".csv" onChange={e=>readCsv(e.target.files?.[0])}/>
          <div className="upload-icon">↥</div><strong>{file ? file.name : "Choose or drop a CSV file"}</strong>
          <small>department · metric_name · metric_value · recorded_on</small>
        </div>
        {preview.length>0 && <div className="csv-preview">
          <div className="preview-head"><strong>Preview</strong><span>Header + first 5 data rows</span></div>
          <div className="preview-table">{preview.map((row,i)=><div className="preview-row" key={i}>{row.map((cell,j)=><span key={j} className={i===0?"header-cell":""}>{cell || "—"}</span>)}</div>)}</div>
          <button className="primary upload-button" onClick={upload} disabled={uploading}>{uploading?"Uploading…":"Upload all records →"}</button>
        </div>}
      </article>
    </section>

    <section className="panel records-panel">
      <div className="records-head">
        <div><span>RECORDS EXPLORER</span><h2>Metric ledger</h2></div>
        <div className="records-tools">
          <input value={search} onChange={e=>{setPage(1);setSearch(e.target.value)}} placeholder="Search metric…"/>
          <select value={filters.department} onChange={e=>{setPage(1);setFilters({...filters,department:e.target.value})}}><option value="">All departments</option>{deps.map(d=><option key={d.id}>{d.name}</option>)}</select>
          <input type="date" value={filters.from} onChange={e=>{setPage(1);setFilters({...filters,from:e.target.value})}}/>
          <input type="date" value={filters.to} onChange={e=>{setPage(1);setFilters({...filters,to:e.target.value})}}/>
        </div>
      </div>
      <div className="table-wrap">
        <table><thead><tr><th>Signal</th><th>Department</th><th>Value</th><th>Recorded</th><th>Uploaded by</th>{user.role==="admin"&&<th/>}</tr></thead>
        <tbody>{rows.map(r=><tr key={r.id}><td><strong>{r.metric_name}</strong><small>#{r.id}</small></td><td><span className="table-tag">{r.department}</span></td><td className="value-cell">₹{Number(r.metric_value).toLocaleString("en-IN")}</td><td>{r.recorded_on}</td><td>{r.uploaded_by}</td>{user.role==="admin"&&<td><button className="table-action danger" onClick={()=>remove(r.id)}>Delete</button></td>}</tr>)}
        {!rows.length&&<tr><td colSpan={user.role==="admin"?6:5}><div className="table-empty">No records match the current view.</div></td></tr>}</tbody></table>
      </div>
      <div className="pagination"><button disabled={page<=1} onClick={()=>setPage(page-1)}>← Previous</button><span>Page <strong>{page}</strong> of <strong>{pages}</strong></span><button disabled={page>=pages} onClick={()=>setPage(page+1)}>Next →</button></div>
    </section>
  </div>;
}

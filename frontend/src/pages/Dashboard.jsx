import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import useDebounce from "../hooks/useDebounce";
import { Area, AreaChart, Bar, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const PALETTE = ["#6d5dfc", "#18b7a0", "#f59e0b", "#3b82f6", "#ec4899"];
const money = n => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

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

function Skeleton({ className = "" }) { return <div className={`skeleton ${className}`}/>; }
function Icon({ children }) { return <span className="metric-icon">{children}</span>; }

export default function Dashboard() {
  const { user } = useAuth();
  const { activities, connected } = useSocket();
  const [filters, setFilters] = useState({ department: "", from: "", to: "" });
  const [departments, setDepartments] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [trend, setTrend] = useState([]);
  const [dept, setDept] = useState([]);
  const [top, setTop] = useState([]);
  const [serverActivity, setServerActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const debouncedDepartment = useDebounce(filters.department, 250);
  const query = useMemo(
    () => ({ department: debouncedDepartment, from: filters.from, to: filters.to }),
    [debouncedDepartment, filters.from, filters.to]
  );

  useEffect(() => {
    api.get("/departments").then(r => setDepartments(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (filters.from && filters.to && filters.from > filters.to) {
      setLoadError("The start date must be before the end date.");
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setLoadError("");

    Promise.all([
      api.get("/kpis", { params: query }),
      api.get("/metrics/trend", { params: query }),
      api.get("/metrics/by-department", { params: query }),
      api.get("/metrics/top", { params: query })
    ]).then(([k, t, d, topResult]) => {
      if (!alive) return;
      setKpis(k.data);
      setTrend(t.data);
      setDept(d.data);
      setTop(topResult.data);
    }).catch(err => {
      if (alive) setLoadError(err.response?.data?.message || "Unable to refresh analytics right now.");
    }).finally(() => alive && setLoading(false));

    return () => { alive = false; };
  }, [query]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    api.get("/activity").then(r => setServerActivity(r.data)).catch(() => {});
  }, [user?.role, activities.length]);

  const mergedActivity = [...activities, ...serverActivity]
    .filter((item, index, all) =>
      index === all.findIndex(x => `${x.id || ""}-${x.action}-${x.created_at}` === `${item.id || ""}-${item.action}-${item.created_at}`)
    )
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5);

  const maxDept = Math.max(...dept.map(d => Number(d.value) || 0), 1);
  const maxTrend = Math.max(...trend.map(item => Number(item.value) || 0), 0);
  const trendDomainMax = maxTrend > 0 ? Math.ceil((maxTrend * 1.15) / 100000) * 100000 : 100000;
  const formatAxisValue = value => {
    const n = Number(value) || 0;
    if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}K`;
    return String(n);
  };
  const rangeLabel = filters.from || filters.to ? `${filters.from || "Start"} → ${filters.to || "Today"}` : "Last 12 months";

  const reset = () => setFilters({ department: "", from: "", to: "" });

  return <div className="page dashboard-page">
    <section className="dashboard-hero">
      <div>
        <div className="eyebrow-row"><span className="eyebrow">EXECUTIVE VIEW</span><span className="hero-chip"><i/> Live intelligence</span></div>
        <h1>Know what moved.<br/><span>Know what matters.</span></h1>
        <p>One workspace for operational signals, department performance and the decisions behind the numbers.</p>
      </div>
      <div className="hero-meta"><div><small>REPORTING WINDOW</small><strong>{rangeLabel}</strong></div><div className="hero-command"><span>EDABIP</span><b>⌘ K</b></div></div>
    </section>

    <section className="filter-strip">
      <div className="filter-title"><span>CONTROL ROOM</span><strong>Focus the view</strong></div>
      <label><span>Department</span><select value={filters.department} onChange={e => setFilters({...filters, department:e.target.value})}><option value="">All departments</option>{departments.map(d => <option key={d.id}>{d.name}</option>)}</select></label>
      <label><span>From</span><input type="date" value={filters.from} onChange={e => setFilters({...filters, from:e.target.value})}/></label>
      <label><span>To</span><input type="date" value={filters.to} onChange={e => setFilters({...filters, to:e.target.value})}/></label>
      <button className="reset-filter" onClick={reset}>Reset</button>
    </section>

    {loadError && <div className="notice failure"><span>!</span>{loadError}</div>}

    <section className="kpi-grid">
      {loading ? [1,2,3,4].map(x => <div className="metric-card" key={x}><Skeleton className="sk-icon"/><Skeleton className="sk-line"/><Skeleton className="sk-value"/><Skeleton className="sk-small"/></div>) : <>
        <MetricCard icon={<Icon>₹</Icon>} label="Total metric value" value={money(kpis?.total_value)} note="Across the active view" tone="violet"/>
        <MetricCard icon={<Icon>↗</Icon>} label="Records in view" value={kpis?.records || 0} note="Tracked intelligence points" tone="teal"/>
        <MetricCard icon={<Icon>◎</Icon>} label="Most active" value={kpis?.active_department || "—"} note="Highest record activity" tone="amber"/>
        <MetricCard icon={<Icon>{Number(kpis?.mom_change) >= 0 ? "↑" : "↓"}</Icon>} label="Month-on-month" value={`${Number(kpis?.mom_change || 0).toFixed(2)}%`} note="Compared with prior month" tone={Number(kpis?.mom_change) >= 0 ? "teal" : "rose"}/>
      </>}
    </section>

    <section className="analytics-grid">
      <article className="panel trend-panel">
        <PanelHeader eyebrow="TRAJECTORY" title="Performance pulse" badge={rangeLabel}/>
        <div className="chart chart-lg">{loading ? <Skeleton className="chart-skeleton"/> : trend.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <defs><linearGradient id="pulse" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6d5dfc" stopOpacity=".32"/><stop offset="100%" stopColor="#6d5dfc" stopOpacity="0"/></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)"/><XAxis dataKey="month" tick={{ fill:"var(--muted)", fontSize:11 }} tickLine={false} axisLine={false} tickMargin={8}/><YAxis domain={[0, trendDomainMax]} tickFormatter={formatAxisValue} tick={{ fill:"var(--muted)", fontSize:11 }} tickLine={false} axisLine={false} width={48} tickMargin={6}/><Tooltip content={<ChartTooltip money/>}/><Area type="monotone" dataKey="value" stroke="#6d5dfc" strokeWidth={3} fill="url(#pulse)" dot={false} activeDot={{ r:5, fill:"#fff", stroke:"#6d5dfc", strokeWidth:3 }}/>
        </AreaChart></ResponsiveContainer> : <EmptyChart text="No trend data for this view."/>}</div>
        <div className="panel-foot"><span><i className="legend-dot violet"/> Aggregate metric value</span><strong>{trend.length ? `${trend.length} periods tracked` : "No data"}</strong></div>
      </article>

      <article className="panel department-panel">
        <PanelHeader eyebrow="DISTRIBUTION" title="Department momentum" badge="Ranked"/>
        <div className="dept-bars">{loading ? [1,2,3,4,5].map(x => <div className="bar-skeleton" key={x}><Skeleton/><Skeleton/></div>) : dept.length ? dept.map((item,i) => <div className="dept-row" key={item.name}><div className="dept-label"><span className="dept-rank">0{i+1}</span><strong>{item.name}</strong><b>{money(item.value)}</b></div><div className="bar-track"><span style={{width:`${Math.max((Number(item.value)/maxDept)*100,7)}%`,background:PALETTE[i%PALETTE.length]}}/></div></div>) : <EmptyChart text="No department data for this view."/>}</div>
        <div className="panel-foot"><span>Highest contribution</span><strong>{dept[0]?.name || "—"}</strong></div>
      </article>
    </section>

    <section className="lower-grid">
      <article className="panel share-panel">
        <PanelHeader eyebrow="MIX" title="Where the value sits" badge="Share"/>
        <div className="donut-layout">
          <div className="donut-chart">{loading ? <Skeleton className="donut-skeleton"/> : dept.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={dept} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95} paddingAngle={4} stroke="var(--panel)">{dept.map((_,i) => <Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}</Pie><Tooltip content={<ChartTooltip money/>}/></PieChart></ResponsiveContainer> : <EmptyChart text="No distribution data."/>}<div className="donut-center"><small>Departments</small><strong>{dept.length || 0}</strong></div></div>
          <div className="legend-list">{dept.map((d,i) => <div key={d.name}><span><i style={{background:PALETTE[i%PALETTE.length]}}/>{d.name}</span><strong>{money(d.value)}</strong></div>)}</div>
        </div>
      </article>

      <article className="panel leaderboard-panel">
        <PanelHeader eyebrow="LEADERBOARD" title="Top signals" badge="Top 5"/>
        <div className="signal-list">{loading ? [1,2,3,4,5].map(x => <div className="signal-skeleton" key={x}><Skeleton/><Skeleton/><Skeleton/></div>) : top.length ? top.map((item,i) => <div className="signal-row" key={item.name}><span className={`signal-rank rank-${i+1}`}>{String(i+1).padStart(2,"0")}</span><div><strong>{item.name}</strong><small>{item.records} records contributing to this signal</small></div><b>{money(item.value)}</b></div>) : <div className="activity-empty"><strong>No signals found</strong><p>Try widening the selected date range.</p></div>}</div>
      </article>

      <article className="panel activity-panel">
        <PanelHeader eyebrow="AUDIT STREAM" title="Live activity" badge={<><i className={connected ? "pulse-dot" : ""}/>{connected ? "Socket live" : "Reconnecting"}</>}/>
        <div className="activity-stream">{mergedActivity.length ? mergedActivity.map((a,i) => <div className="stream-row" key={`${a.id || "live"}-${i}`}><span className="stream-marker"><i/></span><div><strong>{a.user_name || "Platform"}</strong><span>{a.action || "Activity received"}</span><small>{relativeTime(a.created_at)}</small></div></div>) : <div className="activity-empty"><span>✦</span><strong>No recent changes</strong><p>Admin actions will appear here in real time.</p></div>}</div>
      </article>
    </section>

    <div className="dashboard-footer"><span><i/> Data refreshed automatically</span><span>EDABIP • Enterprise intelligence workspace</span></div>
  </div>;
}

function MetricCard({ icon,label,value,note,tone }) { return <article className={`metric-card ${tone}`}><div className="metric-top">{icon}<span className="metric-arrow">↗</span></div><small>{label}</small><strong>{value}</strong><p>{note}</p></article>; }
function PanelHeader({ eyebrow,title,badge }) { return <div className="panel-header"><div><span>{eyebrow}</span><h2>{title}</h2></div><b>{badge}</b></div>; }
function ChartTooltip({ active,payload,label,money:isMoney }) { if(!active||!payload?.length)return null;return <div className="chart-tooltip"><small>{label}</small><strong>{isMoney?money(payload[0].value):payload[0].value}</strong></div>; }
function EmptyChart({text}) { return <div className="chart-empty">{text}</div>; }

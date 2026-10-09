import axios from "axios";
export const api=axios.create({baseURL:"http://localhost:5000/api"});
api.interceptors.request.use(c=>{const t=localStorage.getItem("edabip_token");if(t)c.headers.Authorization=`Bearer ${t}`;return c;});
export const getParams=(filters={})=>Object.fromEntries(Object.entries(filters).filter(([,v])=>v));

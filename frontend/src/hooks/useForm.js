import { useState } from "react";
export default function useForm(initial={}) {
  const [values,setValues]=useState(initial);
  const set=(name,value)=>setValues(v=>({...v,[name]:value}));
  const reset=()=>setValues(initial);
  return {values,set,reset,setValues};
}

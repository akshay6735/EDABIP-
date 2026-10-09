import {createContext,useContext,useEffect,useState} from "react";
const C=createContext();
export function ThemeProvider({children}){const [dark,setDark]=useState(()=>localStorage.getItem("edabip_theme")==="dark");
useEffect(()=>{document.documentElement.dataset.theme=dark?"dark":"light";localStorage.setItem("edabip_theme",dark?"dark":"light")},[dark]);
return <C.Provider value={{dark,setDark}}>{children}</C.Provider>}
export const useTheme=()=>useContext(C);

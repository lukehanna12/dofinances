/* /login owns its card and its two-way Motion transition.
 * The shell owns the backdrop, logo, buttons, tiles and history/navigation.
 */
import React from "react";
import {createRoot} from "react-dom/client";
import {Auth3} from "../components/Auth3.jsx";
import "../styles.css";
export function mountLogin(host,{onBack,onExitComplete}){
  const root=createRoot(host);
  let leaving=false,closed=false;
  function render(){
    root.render(
      <React.StrictMode>
        <Auth3 exiting={leaving} onBack={onBack} onExitComplete={onExitComplete}/>
      </React.StrictMode>
    );
  }
  render();
  return {
    exit(){if(leaving||closed)return;leaving=true;render();},
    unmount(){if(closed)return;closed=true;root.unmount();}
  };
}

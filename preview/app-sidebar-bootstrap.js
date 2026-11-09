// Preview only: production /app HTML and CSS with navigation but NO account operations.
import {initWorkspaceNavigation} from "./workspace-nav.js";
initWorkspaceNavigation();
for(const id of ["account-email","account-email-detail"]){
  const element=document.getElementById(id);
  if(element)element.textContent="Preview workspace";
}
for(const form of document.querySelectorAll("form")){
  form.addEventListener("submit",event=>event.preventDefault());
  for(const field of form.querySelectorAll("button,input,select,textarea")){
    field.disabled=true;
    field.title="Disabled in this static preview";
  }
}
for(const button of document.querySelectorAll("button")){
  if(button.id==="sidebar-toggle"||button.id==="mobile-nav-toggle")continue;
  button.disabled=true;
  button.title="Disabled in this static preview";
}
for(const link of document.querySelectorAll("a[href]")){
  if(link.getAttribute("href")?.startsWith("#"))continue;
  link.removeAttribute("href");
  link.setAttribute("aria-disabled","true");
}

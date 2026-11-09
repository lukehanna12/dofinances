import React from "react";
import { Auth3 } from "./components/Auth3.jsx";
import { StudioSidebarSandbox } from "./components/StudioSidebarSandbox.jsx";

// The Studio hostname is a disposable UI playground. The same Vite bundle is
// packaged at dofinances.com/login, where it must continue to render Auth3.
export function App() {
  return window.location.hostname.toLowerCase() === "stu.dofinances.com"
    ? <StudioSidebarSandbox />
    : <Auth3 />;
}

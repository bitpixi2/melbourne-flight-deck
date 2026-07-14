import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CeilingControls } from "./CeilingControls.js";
import "../styles/ceiling-controls.css";

document.title = "Brenton's Ceiling Controls";
document.body.className = "ceiling-controls-body";

const theme = document.createElement("meta");
theme.name = "theme-color";
theme.content = "#02080b";
document.head.append(theme);

const description = document.createElement("meta");
description.name = "description";
description.content = "Private mobile flight deck and ceiling controls for Brenton's Overhead.";
document.head.append(description);

const manifest = document.createElement("link");
manifest.rel = "manifest";
manifest.href = "/ceiling-controls.webmanifest";
document.head.append(manifest);

const appleIcon = document.createElement("link");
appleIcon.rel = "apple-touch-icon";
appleIcon.href = "/ceiling-controls-icon-192.png";
document.head.append(appleIcon);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/ceiling-controls-sw.js"));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CeilingControls />
  </StrictMode>,
);

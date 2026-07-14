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
description.content = "Private mobile flight deck for Brenton's Option 4 ceiling projector.";
document.head.append(description);

const manifest = document.createElement("link");
manifest.rel = "manifest";
manifest.href = "/ceiling-controls.webmanifest";
document.head.append(manifest);

const appleIcon = document.createElement("link");
appleIcon.rel = "apple-touch-icon";
appleIcon.href = "/ceiling-controls-icon-192.png";
document.head.append(appleIcon);

const appleTitle = document.createElement("meta");
appleTitle.name = "apple-mobile-web-app-title";
appleTitle.content = "Brenton's Ceiling Controls";
document.head.append(appleTitle);

if ("serviceWorker" in navigator) {
  const registerServiceWorker = () => void navigator.serviceWorker.register("/ceiling-controls-sw.js");
  if (document.readyState === "complete") registerServiceWorker();
  else window.addEventListener("load", registerServiceWorker, { once: true });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CeilingControls />
  </StrictMode>,
);

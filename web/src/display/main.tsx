import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { projectorRequested } from "../lib/useAmbientMode.js";
import { Display } from "./Display.js";
import "../styles/display.css";

if (projectorRequested()) {
  document.title = import.meta.env.VITE_COMPANION_ENABLED === "1"
    ? "Brenton's Ceiling Projector — Option 4"
    : "Brenton's Overhead — Live Aircraft";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Display />
  </StrictMode>,
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { projectorRequested } from "../lib/useAmbientMode.js";
import { Display } from "./Display.js";
import "../styles/display.css";

if (projectorRequested()) document.title = "Brenton's Overhead — Live Aircraft";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Display />
  </StrictMode>,
);

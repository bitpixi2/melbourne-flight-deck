import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CeilingControlsDemo } from "./Demo.js";
import "../styles/ceiling-controls.css";
import "../styles/ceiling-controls-demo.css";

document.title = "Brenton's Ceiling Controls — Demo";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CeilingControlsDemo />
  </StrictMode>,
);

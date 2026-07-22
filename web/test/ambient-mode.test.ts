import { describe, expect, it } from "vitest";
import { kioskPanelFullscreenRequested } from "../src/lib/useAmbientMode.js";

describe("dashboard fullscreen targeting", () => {
  it("targets the radar panel only for the explicit kiosk 1 URL", () => {
    expect(kioskPanelFullscreenRequested("?kiosk=1")).toBe(true);
    expect(kioskPanelFullscreenRequested("?kiosk=2")).toBe(false);
    expect(kioskPanelFullscreenRequested("?kiosk=true")).toBe(false);
    expect(kioskPanelFullscreenRequested("")).toBe(false);
  });
});

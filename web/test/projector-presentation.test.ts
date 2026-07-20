import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type Aircraft } from "@shared/index.js";
import { labelLines } from "../src/display/renderer.js";
import { PROJECTOR_SKY_CONFIG } from "../src/display/projectorConfig.js";

describe("overhead projector presentation", () => {
  it("enlarges projector text and aircraft without changing dashboard defaults", () => {
    expect(PROJECTOR_SKY_CONFIG.textScale).toBeGreaterThan(DEFAULT_CONFIG.textScale);
    expect(PROJECTOR_SKY_CONFIG.glyphSizePx).toBeGreaterThan(DEFAULT_CONFIG.glyphSizePx);
    expect(DEFAULT_CONFIG.textScale).toBe(1);
    expect(DEFAULT_CONFIG.glyphSizePx).toBe(22);
    expect(PROJECTOR_SKY_CONFIG.labelCycleSeconds).toBe(12);
    expect(DEFAULT_CONFIG.labelCycleSeconds).toBe(0);
  });

  it("places a verified airport route directly below the flight number", () => {
    const aircraft = {
      hex: "7c0001",
      flight: "QF432",
      origin: "MEL",
      destination: "SYD",
      lat: -37.1,
      lon: 145.0,
      destLat: -33.946,
      destLon: 151.177,
      typeName: "Boeing 737-800",
      altBaro: 17000,
      gs: 430,
    } as Aircraft;

    const lines = labelLines(PROJECTOR_SKY_CONFIG, aircraft);
    expect(lines).toEqual([
      { text: "QF432", kind: "title" },
      { text: "MEL → SYD", kind: "sub" },
      { text: "Boeing 737-800", kind: "sub" },
    ]);
  });
});

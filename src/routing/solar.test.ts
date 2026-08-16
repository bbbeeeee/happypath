import { describe, expect, it } from "vitest";
import { solarPosition } from "./solar.mjs";

describe("solarPosition", () => {
  it("produces a plausible summer-afternoon position in NYC", () => {
    const position = solarPosition("2026-08-15", 15, 40.731, -73.997, -4);
    expect(position.elevationDegrees).toBeGreaterThan(40);
    expect(position.elevationDegrees).toBeLessThan(60);
    expect(position.azimuthDegrees).toBeGreaterThan(210);
    expect(position.azimuthDegrees).toBeLessThan(250);
  });

  it("places the sun below the horizon at night", () => {
    expect(solarPosition("2026-08-15", 2, 40.731, -73.997, -4).elevationDegrees).toBeLessThan(0);
  });
});

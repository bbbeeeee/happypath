import { describe, expect, it } from "vitest";
import {
  isInsideSupportedArea,
  partitionForCoordinate,
  partitionsIntersectingBounds,
  shadowTilesIntersectingBounds,
  supportedArea,
  supportedAreaBbox,
} from "./supportedArea";

describe("Manhattan supported area", () => {
  it("includes representative Manhattan locations from the Battery through 60th Street", () => {
    expect(isInsideSupportedArea([-74.0134, 40.7046])).toBe(true); // Battery Park
    expect(isInsideSupportedArea([-74.006, 40.7128])).toBe(true); // FiDi
    expect(isInsideSupportedArea([-73.9973, 40.7308])).toBe(true); // Washington Square
    expect(isInsideSupportedArea([-73.9855, 40.758])).toBe(true); // Times Square
    expect(isInsideSupportedArea([-73.9735, 40.7644])).toBe(true); // 59th Street
  });

  it("rejects nearby points outside Manhattan and north of the supported cutoff", () => {
    expect(isInsideSupportedArea([-73.9969, 40.7033])).toBe(false); // Brooklyn waterfront
    expect(isInsideSupportedArea([-74.035, 40.728])).toBe(false); // Jersey City
    expect(isInsideSupportedArea([-73.9654, 40.7829])).toBe(false); // Upper East Side
  });

  it("assigns every supported latitude band to one stable partition", () => {
    expect(partitionForCoordinate([-74.01, 40.705])?.id).toBe("fidi");
    expect(partitionForCoordinate([-73.9973, 40.7308])?.id).toBe("village");
    expect(partitionForCoordinate([-73.9855, 40.758])?.id).toBe("midtown-south");
    expect(partitionForCoordinate([-73.9735, 40.7644])?.id).toBe("midtown-south");
    expect(partitionForCoordinate([-73.96, 40.75])).toBeNull();
  });

  it("exposes an envelope and viewport partition intersections", () => {
    expect(supportedAreaBbox()).toEqual([40.699, -74.0195, 40.7708, -73.958]);
    expect(partitionsIntersectingBounds({
      south: 40.739,
      west: -74.01,
      north: 40.744,
      east: -73.98,
    }).map((partition) => partition.id)).toEqual(["village", "chelsea"]);
    expect(shadowTilesIntersectingBounds({
      south: 40.739,
      west: -74.01,
      north: 40.744,
      east: -73.99,
    })).toEqual([
      "village-col-0", "village-col-1", "village-col-2",
      "chelsea-col-0", "chelsea-col-1", "chelsea-col-2",
    ]);
    expect(supportedArea.polygon[0]).toEqual(supportedArea.polygon.at(-1));
  });
});

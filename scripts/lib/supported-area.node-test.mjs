import test from "node:test";
import assert from "node:assert/strict";
import {
  SUPPORTED_AREA_BBOX,
  bboxForPartition,
  coordinateInsideSupportedArea,
  geometryIntersectsSupportedArea,
  partitionForCoordinate,
  socrataWithinBox,
  supportedArea,
  supportedAreaOverpassPolygon,
} from "./supported-area.mjs";

test("supported-area helpers clip nearby boroughs and preserve Manhattan", () => {
  assert.equal(coordinateInsideSupportedArea([-74.0134, 40.7046]), true);
  assert.equal(coordinateInsideSupportedArea([-73.9735, 40.7644]), true);
  assert.equal(coordinateInsideSupportedArea([-73.9969, 40.7033]), false);
  assert.equal(coordinateInsideSupportedArea([-74.035, 40.728]), false);
  assert.equal(geometryIntersectsSupportedArea({ type: "LineString", coordinates: [[-74.006, 40.7128], [-73.9969, 40.7033]] }), true);
});

test("supported-area helpers produce stable partition and query inputs", () => {
  assert.equal(partitionForCoordinate([-73.9855, 40.758])?.id, "midtown-south");
  assert.deepEqual(bboxForPartition(supportedArea.partitions[0], 0.001), [40.699, -74.0195, 40.714, -73.958]);
  assert.equal(socrataWithinBox("the_geom"), `within_box(the_geom,${SUPPORTED_AREA_BBOX.join(",")})`);
  assert.match(supportedAreaOverpassPolygon(), /^40\.699 -74\.0145 /);
});

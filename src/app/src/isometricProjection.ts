export interface IsometricProjectionConfig {
  seedLatitude: number;
  seedLongitude: number;
  cameraAzimuthDegrees: number;
  cameraElevationDegrees: number;
  viewportWidthPixels: number;
  viewportHeightPixels: number;
  viewHeightMeters: number;
  tileStep: number;
}

export interface IsometricImageTransform {
  originX: number;
  originY: number;
  tileSize: number;
  projection?: IsometricProjectionConfig;
}

export interface ImagePoint {
  x: number;
  y: number;
}

// The currently published NYC render was generated from this camera setup.
// Newly exported tile sets carry these values in their metadata instead.
export const DEFAULT_NYC_ISOMETRIC_PROJECTION: IsometricProjectionConfig = {
  seedLatitude: 40.7484,
  seedLongitude: -73.9857,
  cameraAzimuthDegrees: -15,
  cameraElevationDegrees: -45,
  viewportWidthPixels: 1024,
  viewportHeightPixels: 1024,
  viewHeightMeters: 300,
  tileStep: 0.5,
};

/**
 * Project a geographic point into the assembled isometric DZI image.
 *
 * This is the TypeScript inverse of calculate_quadrant_lat_lng in the Python
 * generation pipeline. Integer quadrant coordinates identify the bottom-right
 * anchor of a rendered quadrant, hence the one-tile anchor offset below.
 */
export function latLngToIsometricImagePoint(
  latitude: number,
  longitude: number,
  transform: IsometricImageTransform,
): ImagePoint {
  const projection = transform.projection ?? DEFAULT_NYC_ISOMETRIC_PROJECTION;
  const radians = Math.PI / 180;
  const metersPerPixel =
    projection.viewHeightMeters / projection.viewportHeightPixels;

  const deltaNorthMeters =
    (latitude - projection.seedLatitude) * 111_111;
  const deltaEastMeters =
    (longitude - projection.seedLongitude) *
    111_111 *
    Math.cos(projection.seedLatitude * radians);

  const azimuth = projection.cameraAzimuthDegrees * radians;
  const rotatedX =
    deltaEastMeters * Math.cos(azimuth) -
    deltaNorthMeters * Math.sin(azimuth);
  const rotatedY =
    deltaEastMeters * Math.sin(azimuth) +
    deltaNorthMeters * Math.cos(azimuth);

  const elevation = projection.cameraElevationDegrees * radians;
  const shiftXPixels = rotatedX / metersPerPixel;
  const shiftYPixels = (-rotatedY * Math.sin(elevation)) / metersPerPixel;
  const quadrantX =
    shiftXPixels /
    (projection.viewportWidthPixels * projection.tileStep);
  const quadrantY =
    -shiftYPixels /
    (projection.viewportHeightPixels * projection.tileStep);

  return {
    x: (quadrantX - transform.originX + 1) * transform.tileSize,
    y: (quadrantY - transform.originY + 1) * transform.tileSize,
  };
}

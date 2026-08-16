export interface SolarPosition { elevationDegrees: number; azimuthDegrees: number; method: "noaa-solar-approx-v1" }
export function solarPosition(dateString: string, hour: number, latitude: number, longitude: number, utcOffsetHours: number): SolarPosition;

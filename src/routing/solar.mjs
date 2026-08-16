const radians = (degrees) => (degrees * Math.PI) / 180;
const degrees = (value) => (value * 180) / Math.PI;

/** NOAA-style solar position approximation, deterministic for a local civil time. */
export function solarPosition(dateString, hour, latitude, longitude, utcOffsetHours) {
  const [year, month, day] = dateString.split("-").map(Number);
  const start = Date.UTC(year, 0, 0);
  const current = Date.UTC(year, month - 1, day);
  const dayOfYear = Math.floor((current - start) / 86_400_000);
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (hour - 12) / 24);
  const equationOfTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const trueSolarMinutes = ((hour * 60 + equationOfTime + 4 * longitude - 60 * utcOffsetHours) % 1440 + 1440) % 1440;
  const hourAngleDegrees = trueSolarMinutes / 4 - 180;
  const hourAngle = radians(hourAngleDegrees);
  const latitudeRadians = radians(latitude);
  const cosZenith = Math.sin(latitudeRadians) * Math.sin(declination) + Math.cos(latitudeRadians) * Math.cos(declination) * Math.cos(hourAngle);
  const elevation = 90 - degrees(Math.acos(Math.max(-1, Math.min(1, cosZenith))));
  const azimuth = (degrees(Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(latitudeRadians) - Math.tan(declination) * Math.cos(latitudeRadians))) + 180) % 360;
  return { elevationDegrees: elevation, azimuthDegrees: azimuth, method: "noaa-solar-approx-v1" };
}

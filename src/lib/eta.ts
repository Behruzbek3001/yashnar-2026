/** Rough arrival-time estimate: straight-line distance × road factor at an average city speed. */
const EARTH_RADIUS_KM = 6371;
const ROAD_FACTOR = 1.35; // streets are longer than a straight line
const AVG_SPEED_KMH = 20; // garbage truck in town, including stops

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export function estimateArrival(lat1: number, lng1: number, lat2: number, lng2: number) {
  const roadKm = distanceKm(lat1, lng1, lat2, lng2) * ROAD_FACTOR;
  const minutes = Math.max(1, Math.round((roadKm / AVG_SPEED_KMH) * 60));
  return { roadKm, minutes };
}

export function formatEta(minutes: number): string {
  if (minutes < 60) return `≈ ${minutes} daqiqa`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `≈ ${h} soat ${m} daqiqa` : `≈ ${h} soat`;
}

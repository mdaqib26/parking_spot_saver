import { UnitSystem } from '../types/parking';

const EARTH_RADIUS_M = 6371000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

export function calculateBearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const dLambda = toRadians(lon2 - lon1);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  const theta = Math.atan2(y, x);
  return (toDegrees(theta) + 360) % 360;
}

export function cardinalDirection(degrees: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(((degrees % 360) / 45)) % 8;
  return dirs[idx];
}

export function formatDistance(
  meters: number,
  unit: UnitSystem
): { value: string; label: string; walkMinutes: string } {
  const walkMins = Math.max(1, Math.round(meters / 80));
  const walkMinutes = meters < 15 ? 'Arrived' : `~${walkMins} min walk`;

  if (unit === 'imperial') {
    const feet = meters * 3.28084;
    if (feet < 1000) {
      return { value: `${Math.round(feet)}`, label: 'ft', walkMinutes };
    }
    const miles = meters / 1609.344;
    return {
      value: miles < 10 ? miles.toFixed(2) : miles.toFixed(1),
      label: 'mi',
      walkMinutes,
    };
  }

  if (meters < 1000) {
    return { value: `${Math.round(meters)}`, label: 'm', walkMinutes };
  }
  const km = meters / 1000;
  return {
    value: km < 10 ? km.toFixed(2) : km.toFixed(1),
    label: 'km',
    walkMinutes,
  };
}

export function formatRelativeTime(savedAt: number, now: number): string {
  const diffSec = Math.max(0, Math.floor((now - savedAt) / 1000));
  if (diffSec < 15) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m ago` : `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h ago` : `${days}d ago`;
}

export function formatDurationSpan(startMs: number, endMs: number): string {
  const diffMin = Math.max(1, Math.round((endMs - startMs) / 60000));
  if (diffMin < 60) return `${diffMin}m parked`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m > 0 ? `${h}h ${m}m parked` : `${h}h parked`;
}

export function formatCountdownClock(remainingMs: number): string {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lng).toFixed(5)}° ${lngDir}`;
}

export function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}

export function buildGeoIntentUrl(lat: number, lng: number): string {
  return `geo:${lat},${lng}?q=${lat},${lng}(Parked+Vehicle)`;
}

export type UnitSystem = 'metric' | 'imperial';

export type GpsStatus =
  | 'idle'
  | 'acquiring'
  | 'ready'
  | 'denied'
  | 'unavailable'
  | 'error'
  | 'simulated';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number | null;
  timestamp: number;
}

export interface ParkingSpot {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  savedAt: number;
  note: string;
  photoDataUrl?: string;
  meterExpiresAt?: number | null;
  endedAt?: number;
  isSimulated?: boolean;
}

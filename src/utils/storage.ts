import { ParkingSpot, UnitSystem } from '../types/parking';

const ACTIVE_SPOT_KEY = 'spotlock.activeSpot.v1';
const HISTORY_KEY = 'spotlock.history.v1';
const UNIT_KEY = 'spotlock.unitSystem.v1';
const MAX_HISTORY_ITEMS = 20;

export function loadActiveSpot(): ParkingSpot | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SPOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ParkingSpot;
    if (
      typeof parsed?.latitude !== 'number' ||
      typeof parsed?.longitude !== 'number' ||
      typeof parsed?.savedAt !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveActiveSpot(spot: ParkingSpot | null): void {
  try {
    if (!spot) {
      localStorage.removeItem(ACTIVE_SPOT_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_SPOT_KEY, JSON.stringify(spot));
  } catch {
    // Retry without photo if storage quota is tight
    if (spot?.photoDataUrl) {
      try {
        const trimmed = { ...spot, photoDataUrl: undefined };
        localStorage.setItem(ACTIVE_SPOT_KEY, JSON.stringify(trimmed));
      } catch {
        // Ignore if storage unavailable
      }
    }
  }
}

export function loadHistory(): ParkingSpot[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistory(items: ParkingSpot[]): void {
  const capped = items.slice(0, MAX_HISTORY_ITEMS);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(capped));
  } catch {
    // Strip photos from older history entries if quota exceeded
    const lean = capped.map((item, idx) =>
      idx > 2 ? { ...item, photoDataUrl: undefined } : item
    );
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(lean));
    } catch {
      // Ignore if storage unavailable
    }
  }
}

export function loadUnitSystem(): UnitSystem {
  try {
    const raw = localStorage.getItem(UNIT_KEY);
    return raw === 'imperial' ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
}

export function saveUnitSystem(unit: UnitSystem): void {
  try {
    localStorage.setItem(UNIT_KEY, unit);
  } catch {
    // Ignore if storage unavailable
  }
}

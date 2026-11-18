import { useCallback, useEffect, useRef, useState } from 'react';
import { GeoPoint, GpsStatus } from '../types/parking';

interface DeviceOrientationEventWithWebkit extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

interface DeviceOrientationStatic {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

export function useParkingSensors() {
  const [currentPosition, setCurrentPosition] = useState<GeoPoint | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('acquiring');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const [needsCompassPermission, setNeedsCompassPermission] = useState(false);
  const [compassDenied, setCompassDenied] = useState(false);

  const watchIdRef = useRef<number | null>(null);

  const clearExistingWatch = () => {
    if (
      watchIdRef.current !== null &&
      typeof navigator !== 'undefined' &&
      'geolocation' in navigator
    ) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const startWatchWithPrecision = useCallback((highAccuracy: boolean) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGpsStatus('unavailable');
      setGpsError('Geolocation is not supported by this browser.');
      return;
    }

    clearExistingWatch();
    setGpsStatus('acquiring');
    setGpsError(null);

    // Quick initial fix first (especially helpful indoors on laptops/phones)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsStatus('ready');
        setGpsError(null);
        setCurrentPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 0),
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus('denied');
          setGpsError(
            'Location permission was denied. Allow location access in your browser bar or search your current area below.'
          );
          return;
        }
        // If high-accuracy timed out / unavailable indoors, fall back to Wi-Fi/network location
        if (highAccuracy) {
          startWatchWithPrecision(false);
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsStatus('unavailable');
          setGpsError(
            'Your device could not determine its GPS location. Try retrying or search your current street/area.'
          );
        } else {
          setGpsStatus('error');
          setGpsError('Location request timed out. Tap Retry Location.');
        }
      },
      {
        enableHighAccuracy: highAccuracy,
        maximumAge: highAccuracy ? 5000 : 30000,
        timeout: highAccuracy ? 10000 : 12000,
      }
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus('ready');
        setGpsError(null);
        setCurrentPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 0),
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus('denied');
          setGpsError(
            'Location permission was denied. Allow location access in your browser bar or search your current area below.'
          );
        } else if (highAccuracy) {
          startWatchWithPrecision(false);
        }
      },
      {
        enableHighAccuracy: highAccuracy,
        maximumAge: 5000,
        timeout: 15000,
      }
    );
  }, []);

  const startGpsWatch = useCallback(() => {
    startWatchWithPrecision(true);
  }, [startWatchWithPrecision]);

  useEffect(() => {
    startGpsWatch();
    return () => {
      clearExistingWatch();
    };
  }, [startGpsWatch]);

  // Device orientation compass listener
  const attachCompassListener = useCallback(() => {
    const handleOrientation = (event: Event) => {
      const e = event as DeviceOrientationEventWithWebkit;
      if (
        typeof e.webkitCompassHeading === 'number' &&
        !Number.isNaN(e.webkitCompassHeading)
      ) {
        setCompassHeading(e.webkitCompassHeading);
      } else if (typeof e.alpha === 'number' && !Number.isNaN(e.alpha)) {
        const heading = (360 - e.alpha) % 360;
        setCompassHeading(heading);
      }
    };

    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);

    return () => {
      window.removeEventListener(
        'deviceorientationabsolute',
        handleOrientation,
        true
      );
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('DeviceOrientationEvent' in window)
    ) {
      return;
    }

    const DOE =
      window.DeviceOrientationEvent as unknown as DeviceOrientationStatic;
    if (typeof DOE.requestPermission === 'function') {
      setNeedsCompassPermission(true);
      return;
    }

    const cleanup = attachCompassListener();
    return cleanup;
  }, [attachCompassListener]);

  const requestCompassPermission = useCallback(async () => {
    if (
      typeof window === 'undefined' ||
      !('DeviceOrientationEvent' in window)
    ) {
      return;
    }
    const DOE =
      window.DeviceOrientationEvent as unknown as DeviceOrientationStatic;
    if (typeof DOE.requestPermission === 'function') {
      try {
        const res = await DOE.requestPermission();
        if (res === 'granted') {
          setNeedsCompassPermission(false);
          setCompassDenied(false);
          attachCompassListener();
        } else {
          setCompassDenied(true);
        }
      } catch {
        setCompassDenied(true);
      }
    }
  }, [attachCompassListener]);

  const captureCurrentPosition = useCallback(async (): Promise<GeoPoint> => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      if (currentPosition) return currentPosition;
      throw new Error('Geolocation is unavailable on this device.');
    }

    const tryGet = (highAccuracy: boolean) =>
      new Promise<GeoPoint>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const point: GeoPoint = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: Math.round(pos.coords.accuracy || 0),
              heading: pos.coords.heading,
              timestamp: Date.now(),
            };
            setCurrentPosition(point);
            setGpsStatus('ready');
            setGpsError(null);
            resolve(point);
          },
          (err) => reject(err),
          {
            enableHighAccuracy: highAccuracy,
            maximumAge: 4000,
            timeout: highAccuracy ? 8000 : 10000,
          }
        );
      });

    try {
      return await tryGet(true);
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 1 && currentPosition) {
        return currentPosition;
      }
      if (code !== 1) {
        try {
          return await tryGet(false);
        } catch {
          if (currentPosition) return currentPosition;
        }
      }
      if (currentPosition) return currentPosition;
      throw new Error(
        'Could not acquire GPS fix. Allow location permission or set your area manually.'
      );
    }
  }, [currentPosition]);

  const setManualLocation = useCallback((latitude: number, longitude: number) => {
    clearExistingWatch();
    setGpsStatus('ready');
    setGpsError(null);
    setCurrentPosition({
      latitude,
      longitude,
      accuracy: 25,
      timestamp: Date.now(),
    });
  }, []);

  return {
    currentPosition,
    gpsStatus,
    gpsError,
    compassHeading,
    needsCompassPermission,
    compassDenied,
    startGpsWatch,
    requestCompassPermission,
    captureCurrentPosition,
    setManualLocation,
  };
}

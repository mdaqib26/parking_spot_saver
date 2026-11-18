import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  ExternalLink,
  History,
  MapPin,
  Navigation,
  RefreshCw,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { AndroidGuideModal } from './components/AndroidGuideModal';
import { HistoryView } from './components/HistoryView';
import {
  GroundedMapPlace,
  NearbyParkingList,
} from './components/NearbyParkingList';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import {
  NearbyParkingPlace,
  ParkingGoogleMap,
} from './components/ParkingGoogleMap';
import { SpotContextCard } from './components/SpotContextCard';
import { useParkingSensors } from './hooks/useParkingSensors';
import { ParkingSpot, UnitSystem } from './types/parking';
import {
  buildGeoIntentUrl,
  buildGoogleMapsUrl,
  calculateBearingDegrees,
  calculateDistanceMeters,
  cardinalDirection,
  formatCoordinates,
  formatDistance,
  formatRelativeTime,
} from './utils/geodesy';
import {
  loadActiveSpot,
  loadHistory,
  loadUnitSystem,
  saveActiveSpot,
  saveHistory,
  saveUnitSystem,
} from './utils/storage';

export default function App() {
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const [activeSpot, setActiveSpot] = useState<ParkingSpot | null>(() =>
    loadActiveSpot()
  );
  const [history, setHistory] = useState<ParkingSpot[]>(() => loadHistory());
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() =>
    loadUnitSystem()
  );
  const [now, setNow] = useState<number>(() => Date.now());

  const [draftNote, setDraftNote] = useState('');
  const [draftPhoto, setDraftPhoto] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyParkingPlace[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [groundedSummary, setGroundedSummary] = useState('');
  const [groundedPlaces, setGroundedPlaces] = useState<GroundedMapPlace[]>([]);
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [showAndroidModal, setShowAndroidModal] = useState(false);

  const {
    currentPosition,
    gpsStatus,
    gpsError,
    compassHeading,
    needsCompassPermission,
    startGpsWatch,
    requestCompassPermission,
    captureCurrentPosition,
    setManualLocation,
  } = useParkingSensors();

  useEffect(() => {
    const onQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () =>
      window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  useEffect(() => {
    if (mapsApiKey) return;
    fetch('/api/maps-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { mapsApiKey?: string } | null) => {
        if (data?.mapsApiKey) {
          setMapsApiKey(data.mapsApiKey);
        }
      })
      .catch(() => {
        // Offline fallback handled cleanly by SpotMiniMap
      });
  }, [mapsApiKey]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    saveActiveSpot(activeSpot);
  }, [activeSpot]);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  useEffect(() => {
    saveUnitSystem(unitSystem);
  }, [unitSystem]);

  const fetchGroundedNearbyParking = useCallback(
    async (lat: number, lng: number, queryText?: string) => {
      setIsSearchingNearby(true);
      setNearbyError(null);
      try {
        const res = await fetch('/api/parking/nearby', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: lat,
            longitude: lng,
            query: queryText ?? searchQuery,
          }),
        });
        const data = (await res.json()) as {
          summary?: string;
          places?: GroundedMapPlace[];
          error?: string;
          quotaExceeded?: boolean;
        };
        if (!res.ok) {
          setNearbyError(data.error || 'Unable to look up nearby parking.');
          return;
        }
        setGroundedSummary(data.summary || '');
        setGroundedPlaces(Array.isArray(data.places) ? data.places : []);
      } catch {
        setNearbyError(
          'Network offline — showing saved map and cached coordinates.'
        );
      } finally {
        setIsSearchingNearby(false);
      }
    },
    [searchQuery]
  );

  const telemetry = useMemo(() => {
    if (!activeSpot || !currentPosition) {
      return { distanceMeters: null, bearingDegrees: null };
    }
    return {
      distanceMeters: calculateDistanceMeters(
        currentPosition.latitude,
        currentPosition.longitude,
        activeSpot.latitude,
        activeSpot.longitude
      ),
      bearingDegrees: calculateBearingDegrees(
        currentPosition.latitude,
        currentPosition.longitude,
        activeSpot.latitude,
        activeSpot.longitude
      ),
    };
  }, [activeSpot, currentPosition]);

  const handleSaveCurrentSpot = async () => {
    setSaveError(null);
    setIsSaving(true);
    try {
      const point = await captureCurrentPosition();
      const spot: ParkingSpot = {
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`,
        latitude: point.latitude,
        longitude: point.longitude,
        accuracy: point.accuracy,
        savedAt: Date.now(),
        note: draftNote.trim(),
        photoDataUrl: draftPhoto,
      };
      if (activeSpot) {
        setHistory((prev) => [{ ...activeSpot, endedAt: Date.now() }, ...prev]);
      }
      setActiveSpot(spot);
      setDraftNote('');
      setDraftPhoto(undefined);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Could not get your current GPS location. Allow permission or set your area on the map.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveChosenLocation = useCallback(
    (lat: number, lng: number, label: string) => {
      const combinedNote = draftNote.trim()
        ? `${label} · ${draftNote.trim()}`
        : label;
      const spot: ParkingSpot = {
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`,
        latitude: lat,
        longitude: lng,
        accuracy: currentPosition?.accuracy ?? 10,
        savedAt: Date.now(),
        note: combinedNote,
        photoDataUrl: draftPhoto,
      };
      if (activeSpot) {
        setHistory((prev) => [{ ...activeSpot, endedAt: Date.now() }, ...prev]);
      }
      setActiveSpot(spot);
      setDraftNote('');
      setDraftPhoto(undefined);
      setSelectedPlaceId(null);
      setSaveError(null);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2500);
    },
    [activeSpot, currentPosition, draftNote, draftPhoto]
  );

  const handleClearSpot = () => {
    if (!activeSpot) return;
    setHistory((prev) => [{ ...activeSpot, endedAt: Date.now() }, ...prev]);
    setActiveSpot(null);
  };

  const handleRestoreSpot = (spot: ParkingSpot) => {
    if (activeSpot) {
      setHistory((prev) => [
        { ...activeSpot, endedAt: Date.now() },
        ...prev.filter((item) => item.id !== spot.id),
      ]);
    } else {
      setHistory((prev) => prev.filter((item) => item.id !== spot.id));
    }
    setActiveSpot({ ...spot, endedAt: undefined });
  };

  const formattedDist =
    telemetry.distanceMeters !== null
      ? formatDistance(telemetry.distanceMeters, unitSystem)
      : null;

  const isArrived =
    telemetry.distanceMeters !== null && telemetry.distanceMeters < 15;

  return (
    <div className="min-h-screen bg-[#0B0D11] text-[#F4F7FB] pb-12">
      {/* Required Google Maps Demo Key Quota Banner */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Simple Android-Style Header */}
      <header className="border-b border-white/10 bg-[#0B0D11]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-[#0B0D11]">
              <MapPin className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="font-display truncate text-base font-bold text-white sm:text-lg">
              Parking Spot Saver
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />

            <button
              type="button"
              onClick={() => setShowAndroidModal(true)}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-white/10 bg-[#14171D] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#1D222B] whitespace-nowrap"
            >
              <Smartphone className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <span>Android</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-white/10 bg-[#14171D] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#1D222B] whitespace-nowrap"
            >
              <History className="h-4 w-4 text-amber-400" aria-hidden="true" />
              <span>History ({history.length})</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-5 sm:px-6 sm:pt-7">
        {justSaved && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            <span>Parking spot and time saved.</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
          {/* LEFT COLUMN: Real Current-Location Google Map + Save / Navigate */}
          <div className="space-y-5 lg:col-span-7">
            <ParkingGoogleMap
              mapsApiKey={mapsApiKey}
              quotaExceeded={quotaExceeded}
              currentPosition={currentPosition}
              gpsStatus={gpsStatus}
              gpsError={gpsError}
              activeSpot={activeSpot}
              nearbyPlaces={nearbyPlaces}
              selectedPlaceId={selectedPlaceId}
              unitSystem={unitSystem}
              compassHeading={compassHeading}
              onRetryGps={startGpsWatch}
              onSetManualLocation={setManualLocation}
              onNearbyPlacesFound={setNearbyPlaces}
              onSelectNearbyPlace={(p) =>
                setSelectedPlaceId(p.id ? p.id : null)
              }
              onSaveChosenSpot={handleSaveChosenLocation}
            />

            {!activeSpot ? (
              <section
                aria-label="Save parking spot"
                className="rounded-3xl border border-white/10 bg-[#14171D] p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#9CA3AF]">
                  <span>
                    {gpsStatus === 'ready' && currentPosition
                      ? `Current GPS ready · ±${currentPosition.accuracy} m`
                      : gpsStatus === 'acquiring'
                        ? 'Getting your current GPS location…'
                        : 'Location access needed'}
                  </span>
                  {currentPosition ? (
                    <span className="font-mono-tabular text-[#D1D5DB]">
                      {formatCoordinates(
                        currentPosition.latitude,
                        currentPosition.longitude
                      )}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={startGpsWatch}
                      className="inline-flex items-center gap-1 font-semibold text-amber-400 hover:underline"
                    >
                      <RefreshCw className="h-3 w-3" aria-hidden="true" />
                      <span>Refresh GPS</span>
                    </button>
                  )}
                </div>

                <h1 className="font-display mt-2 text-2xl font-bold text-white sm:text-3xl">
                  Choose a nearby spot or save your location
                </h1>
                <p className="mt-1.5 text-sm text-[#9CA3AF]">
                  Pick a nearby green <strong className="text-emerald-400">P</strong> parking pin on your map, tap the map to drop a pin, or save where you are standing right now.
                </p>

                {saveError && (
                  <p
                    role="alert"
                    className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300"
                  >
                    {saveError}
                  </p>
                )}

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={handleSaveCurrentSpot}
                    disabled={isSaving}
                    className="inline-flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-2xl bg-amber-500 px-6 py-4 text-base font-bold text-[#0B0D11] shadow-lg shadow-amber-500/15 transition-transform hover:bg-amber-400 active:scale-[0.98] disabled:opacity-60 whitespace-nowrap"
                  >
                    <MapPin className="h-5 w-5" aria-hidden="true" />
                    <span>
                      {isSaving ? 'Saving GPS Spot…' : 'Save my parking spot'}
                    </span>
                  </button>
                </div>
              </section>
            ) : (
              <div className="space-y-4">
                <section
                  aria-label="Saved spot and distance"
                  className="rounded-3xl border border-white/10 bg-[#14171D] p-5 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-amber-400">
                        Saved Parking Spot
                      </p>
                      <h1 className="font-display mt-1 text-2xl font-bold text-white">
                        {activeSpot.note.trim() || 'Your Parked Vehicle'}
                      </h1>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearSpot}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/10 bg-[#1D222B] px-3 text-xs font-semibold text-[#9CA3AF] hover:border-red-500/40 hover:text-red-300 whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      <span>Clear</span>
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#D1D5DB]">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                      <Clock className="h-4 w-4 text-amber-400" aria-hidden="true" />
                      <span className="font-mono-tabular">
                        Saved {formatRelativeTime(activeSpot.savedAt, now)}
                      </span>
                    </span>
                    <span className="text-[#6B7280]" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-[#9CA3AF]">
                      at{' '}
                      {new Date(activeSpot.savedAt).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                    <div>
                      <p className="text-xs font-medium text-[#9CA3AF]">
                        Distance to your car now
                      </p>
                      {formattedDist ? (
                        <div className="mt-0.5 flex items-baseline gap-2">
                          <span
                            className={`font-mono-tabular text-3xl font-bold sm:text-4xl ${
                              isArrived ? 'text-emerald-400' : 'text-white'
                            }`}
                          >
                            {formattedDist.value} {formattedDist.label}
                          </span>
                          <span className="text-xs text-[#9CA3AF]">
                            {isArrived
                              ? '· Right next to your car'
                              : `· ${formattedDist.walkMinutes}${
                                  telemetry.bearingDegrees !== null
                                    ? ` (${cardinalDirection(telemetry.bearingDegrees)})`
                                    : ''
                                }`}
                          </span>
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-[#9CA3AF]">
                          Checking your current GPS location…
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {needsCompassPermission && (
                        <button
                          type="button"
                          onClick={requestCompassPermission}
                          className="min-h-[36px] rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 text-xs font-semibold text-amber-300"
                        >
                          Compass
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setUnitSystem((prev) =>
                            prev === 'metric' ? 'imperial' : 'metric'
                          )
                        }
                        className="min-h-[36px] rounded-lg border border-white/10 bg-[#1D222B] px-2.5 text-xs font-semibold text-[#D1D5DB] hover:bg-white/10"
                      >
                        {unitSystem === 'metric' ? 'm / km' : 'ft / mi'}
                      </button>
                    </div>
                  </div>
                </section>

                <div className="space-y-2">
                  <a
                    href={buildGoogleMapsUrl(
                      activeSpot.latitude,
                      activeSpot.longitude
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-2xl bg-amber-500 px-6 py-4 text-base font-bold text-[#0B0D11] shadow-lg shadow-amber-500/15 transition-transform hover:bg-amber-400 active:scale-[0.98]"
                  >
                    <Navigation className="h-5 w-5" aria-hidden="true" />
                    <span>Navigate</span>
                    <ExternalLink className="h-4 w-4 opacity-70" aria-hidden="true" />
                  </a>

                  <div className="flex items-center justify-between px-1 text-xs text-[#9CA3AF]">
                    <span>Opens Google Maps walking directions</span>
                    <a
                      href={buildGeoIntentUrl(
                        activeSpot.latitude,
                        activeSpot.longitude
                      )}
                      className="font-semibold text-amber-400 hover:underline"
                    >
                      Open via geo: intent
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Available Parking Near Your Real Location + Note/Photo */}
          <div className="space-y-5 lg:col-span-5">
            {!activeSpot && (
              <NearbyParkingList
                hasLocation={Boolean(currentPosition)}
                nearbyPlaces={nearbyPlaces}
                groundedSummary={groundedSummary}
                groundedPlaces={groundedPlaces}
                isSearching={isSearchingNearby}
                searchError={nearbyError}
                searchQuery={searchQuery}
                unitSystem={unitSystem}
                selectedPlaceId={selectedPlaceId}
                onChangeSearchQuery={setSearchQuery}
                onSearchNearby={() => {
                  if (!currentPosition) return;
                  fetchGroundedNearbyParking(
                    currentPosition.latitude,
                    currentPosition.longitude,
                    searchQuery
                  );
                }}
                onSelectPlace={(p) => setSelectedPlaceId(p.id)}
                onParkAtPlace={(p) =>
                  handleSaveChosenLocation(p.latitude, p.longitude, p.name)
                }
              />
            )}

            <SpotContextCard
              label={
                activeSpot
                  ? 'Add a note or photo'
                  : 'Add a note or photo (optional)'
              }
              note={activeSpot ? activeSpot.note : draftNote}
              photoDataUrl={activeSpot ? activeSpot.photoDataUrl : draftPhoto}
              onChangeNote={(note) =>
                activeSpot
                  ? setActiveSpot((prev) => (prev ? { ...prev, note } : prev))
                  : setDraftNote(note)
              }
              onChangePhoto={(photoDataUrl) =>
                activeSpot
                  ? setActiveSpot((prev) =>
                      prev ? { ...prev, photoDataUrl } : prev
                    )
                  : setDraftPhoto(photoDataUrl)
              }
            />
          </div>
        </div>
      </main>

      <HistoryView
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        history={history}
        onRestoreSpot={handleRestoreSpot}
        onDeleteSpot={(id) =>
          setHistory((prev) => prev.filter((item) => item.id !== id))
        }
        onClearHistory={() => setHistory([])}
      />

      <AndroidGuideModal
        isOpen={showAndroidModal}
        onClose={() => setShowAndroidModal(false)}
      />

      <OfflineIndicator />
    </div>
  );
}

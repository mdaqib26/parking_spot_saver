import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
} from 'lucide-react';
import { GeoPoint, GpsStatus, ParkingSpot, UnitSystem } from '../types/parking';
import {
  buildGoogleMapsUrl,
  calculateBearingDegrees,
  calculateDistanceMeters,
  formatDistance,
} from '../utils/geodesy';
import { SpotMiniMap } from './SpotMiniMap';

export interface NearbyParkingPlace {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  rating?: number;
  distanceMeters?: number;
}

interface ParkingGoogleMapProps {
  mapsApiKey: string;
  quotaExceeded?: boolean;
  currentPosition: GeoPoint | null;
  gpsStatus: GpsStatus;
  gpsError: string | null;
  activeSpot: ParkingSpot | null;
  nearbyPlaces: NearbyParkingPlace[];
  selectedPlaceId: string | null;
  unitSystem: UnitSystem;
  compassHeading: number | null;
  onRetryGps: () => void;
  onSetManualLocation: (lat: number, lng: number) => void;
  onNearbyPlacesFound: (places: NearbyParkingPlace[]) => void;
  onSelectNearbyPlace: (place: NearbyParkingPlace) => void;
  onSaveChosenSpot: (lat: number, lng: number, label: string) => void;
}

function handleMapsQuotaError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('QuotaExceeded') ||
    msg.includes('429')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

interface NearbyPlacesSearcherProps {
  currentPosition: GeoPoint | null;
  activeSpot: ParkingSpot | null;
  onNearbyPlacesFound: (places: NearbyParkingPlace[]) => void;
}

const NearbyPlacesSearcher: React.FC<NearbyPlacesSearcherProps> = ({
  currentPosition,
  activeSpot,
  onNearbyPlacesFound,
}) => {
  const placesLib = useMapsLibrary('places');
  const lastSearchKeyRef = useRef<string>('');

  useEffect(() => {
    if (!placesLib || !currentPosition || activeSpot) return;

    const searchKey = `${currentPosition.latitude.toFixed(3)},${currentPosition.longitude.toFixed(3)}`;
    if (lastSearchKeyRef.current === searchKey) return;
    lastSearchKeyRef.current = searchKey;

    const searchNearby = async () => {
      try {
        const PlaceClass = placesLib.Place as unknown as {
          searchNearby: (req: {
            fields: string[];
            locationRestriction: {
              center: { lat: number; lng: number };
              radius: number;
            };
            includedPrimaryTypes: string[];
            maxResultCount: number;
          }) => Promise<{
            places?: Array<{
              id?: string;
              displayName?: string;
              formattedAddress?: string;
              location?: { lat: () => number; lng: () => number };
              rating?: number;
            }>;
          }>;
        };

        const { places } = await PlaceClass.searchNearby({
          fields: ['id', 'displayName', 'location', 'formattedAddress', 'rating'],
          locationRestriction: {
            center: {
              lat: currentPosition.latitude,
              lng: currentPosition.longitude,
            },
            radius: 1500,
          },
          includedPrimaryTypes: ['parking'],
          maxResultCount: 10,
        });

        const mapped: NearbyParkingPlace[] = (places ?? [])
          .filter((p) => p.location)
          .map((p, idx) => {
            const lat = p.location!.lat();
            const lng = p.location!.lng();
            return {
              id: p.id || `nearby-${idx}`,
              name: p.displayName || 'Nearby Parking',
              address: p.formattedAddress,
              latitude: lat,
              longitude: lng,
              rating: p.rating,
              distanceMeters: calculateDistanceMeters(
                currentPosition.latitude,
                currentPosition.longitude,
                lat,
                lng
              ),
            };
          })
          .sort(
            (a, b) =>
              (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity)
          );

        onNearbyPlacesFound(mapped);
      } catch (err) {
        handleMapsQuotaError(err);
      }
    };

    searchNearby();
  }, [placesLib, currentPosition, activeSpot, onNearbyPlacesFound]);

  return null;
};

interface WalkingRouteOverlayProps {
  currentPosition: GeoPoint | null;
  activeSpot: ParkingSpot | null;
}

const WalkingRouteOverlay: React.FC<WalkingRouteOverlayProps> = ({
  currentPosition,
  activeSpot,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!map || !routesLib || !currentPosition || !activeSpot) return;

    let cancelled = false;

    const computeWalkingPath = async () => {
      try {
        const RouteClass = routesLib.Route as unknown as {
          computeRoutes: (req: {
            origin: { lat: number; lng: number };
            destination: { lat: number; lng: number };
            travelMode: string;
            fields: string[];
          }) => Promise<{
            routes?: Array<{
              createPolylines: () => google.maps.Polyline[];
              viewport?: google.maps.LatLngBounds;
            }>;
          }>;
        };

        const { routes } = await RouteClass.computeRoutes({
          origin: {
            lat: currentPosition.latitude,
            lng: currentPosition.longitude,
          },
          destination: {
            lat: activeSpot.latitude,
            lng: activeSpot.longitude,
          },
          travelMode: 'WALKING',
          fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
        });

        if (cancelled || !routes || routes.length === 0) return;
        const primaryRoute = routes[0];
        const newLines = primaryRoute.createPolylines();
        newLines.forEach((line) => {
          line.setOptions({
            strokeColor: '#F59E0B',
            strokeWeight: 5,
            strokeOpacity: 0.9,
          });
          line.setMap(map);
        });
        polylinesRef.current = newLines;

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport, 48);
        }
      } catch (err) {
        handleMapsQuotaError(err);
      }
    };

    computeWalkingPath();

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, routesLib, currentPosition, activeSpot]);

  return null;
};

interface MapCameraControllerProps {
  currentPosition: GeoPoint | null;
  activeSpot: ParkingSpot | null;
  selectedPlace: NearbyParkingPlace | null;
  recenterSignal: number;
}

const MapCameraController: React.FC<MapCameraControllerProps> = ({
  currentPosition,
  activeSpot,
  selectedPlace,
  recenterSignal,
}) => {
  const map = useMap();
  const lastCenteredPosRef = useRef<string>('');

  // Auto-pan to user's real location when it first arrives or recenter button is pressed
  useEffect(() => {
    if (!map) return;

    if (selectedPlace) {
      map.panTo({ lat: selectedPlace.latitude, lng: selectedPlace.longitude });
      return;
    }

    if (activeSpot && recenterSignal === 0) {
      map.panTo({ lat: activeSpot.latitude, lng: activeSpot.longitude });
      return;
    }

    if (currentPosition) {
      const key = `${currentPosition.latitude.toFixed(4)},${currentPosition.longitude.toFixed(4)}:${recenterSignal}`;
      if (lastCenteredPosRef.current !== key) {
        map.panTo({
          lat: currentPosition.latitude,
          lng: currentPosition.longitude,
        });
        lastCenteredPosRef.current = key;
      }
    }
  }, [map, currentPosition, activeSpot, selectedPlace, recenterSignal]);

  return null;
};

interface NearbyPlaceMarkerProps {
  place: NearbyParkingPlace;
  isSelected: boolean;
  unitSystem: UnitSystem;
  onSelect: (place: NearbyParkingPlace) => void;
  onParkHere: (place: NearbyParkingPlace) => void;
}

const NearbyPlaceMarker: React.FC<NearbyPlaceMarkerProps> = ({
  place,
  isSelected,
  unitSystem,
  onSelect,
  onParkHere,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const dist =
    typeof place.distanceMeters === 'number'
      ? formatDistance(place.distanceMeters, unitSystem)
      : null;

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: place.latitude, lng: place.longitude }}
        title={place.name}
        onClick={() => onSelect(place)}
      >
        <Pin
          background={isSelected ? '#F59E0B' : '#10B981'}
          borderColor="#FFFFFF"
          glyphColor="#FFFFFF"
          glyphText="P"
          scale={isSelected ? 1.2 : 1.0}
        />
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow
          anchor={marker}
          onCloseClick={() => onSelect({ ...place, id: '' })}
        >
          <div className="min-w-[190px] max-w-[230px] p-1 text-slate-900">
            <p className="text-sm font-bold leading-snug">{place.name}</p>
            {place.address && (
              <p className="mt-0.5 text-xs text-slate-600">{place.address}</p>
            )}
            {dist && (
              <p className="mt-1 text-xs font-semibold text-emerald-700">
                {dist.value} {dist.label} away · {dist.walkMinutes}
              </p>
            )}
            <div className="mt-2.5 flex gap-1.5">
              <button
                type="button"
                onClick={() => onParkHere(place)}
                className="flex-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
              >
                Park Here
              </button>
              <a
                href={buildGoogleMapsUrl(place.latitude, place.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <span>Go</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

interface LocationWaitCardProps {
  gpsStatus: GpsStatus;
  gpsError: string | null;
  onRetryGps: () => void;
  onSetManualLocation: (lat: number, lng: number) => void;
}

const LocationWaitCard: React.FC<LocationWaitCardProps> = ({
  gpsStatus,
  gpsError,
  onRetryGps,
  onSetManualLocation,
}) => {
  const placesLib = useMapsLibrary('places');
  const [addressQuery, setAddressQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const handleAddressLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = addressQuery.trim();
    if (!q) return;
    setLookupError(null);

    if (!placesLib) {
      setLookupError('Google Maps search is still loading. Try again.');
      return;
    }

    setSearching(true);
    try {
      const PlaceClass = placesLib.Place as unknown as {
        searchByText: (req: {
          textQuery: string;
          fields: string[];
          maxResultCount: number;
        }) => Promise<{
          places?: Array<{
            location?: { lat: () => number; lng: () => number };
          }>;
        }>;
      };

      const { places } = await PlaceClass.searchByText({
        textQuery: q,
        fields: ['displayName', 'location'],
        maxResultCount: 1,
      });

      const first = places?.[0]?.location;
      if (!first) {
        setLookupError('Could not find that area. Try a city or landmark.');
        return;
      }

      onSetManualLocation(first.lat(), first.lng());
    } catch (err) {
      handleMapsQuotaError(err);
      setLookupError('Unable to resolve that address right now.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#14171D] p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-400">
        <LocateFixed className="h-6 w-6" aria-hidden="true" />
      </div>

      <h2 className="font-display mt-3.5 text-lg font-bold text-white">
        {gpsStatus === 'acquiring'
          ? 'Getting your current location…'
          : 'Allow location to see parking near you'}
      </h2>

      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-[#9CA3AF]">
        {gpsStatus === 'acquiring'
          ? 'Reading your device GPS so we can center Google Maps right where you are.'
          : gpsError ||
            'Please allow location access in your browser, or enter your current street/area below.'}
      </p>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onRetryGps}
          className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-amber-500 px-4 text-xs font-bold text-[#0B0D11] hover:bg-amber-400"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Use My Current Location</span>
        </button>
      </div>

      <form
        onSubmit={handleAddressLookup}
        className="mt-5 flex w-full max-w-sm gap-2"
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]"
            aria-hidden="true"
          />
          <label htmlFor="manual-location-input" className="sr-only">
            Enter your current street or city
          </label>
          <input
            id="manual-location-input"
            type="text"
            value={addressQuery}
            onChange={(e) => setAddressQuery(e.target.value)}
            placeholder="Or enter your current area / city"
            className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#0B0D11] pl-9 pr-3 text-xs text-white placeholder:text-[#6B7280] focus:border-amber-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="min-h-[42px] rounded-xl border border-white/10 bg-[#1D222B] px-3.5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-60 whitespace-nowrap"
        >
          {searching ? 'Finding…' : 'Set Area'}
        </button>
      </form>

      {lookupError && (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {lookupError}
        </p>
      )}
    </div>
  );
};

const InnerGoogleMap: React.FC<Omit<ParkingGoogleMapProps, 'mapsApiKey'>> = ({
  currentPosition,
  gpsStatus,
  gpsError,
  activeSpot,
  nearbyPlaces,
  selectedPlaceId,
  unitSystem,
  compassHeading,
  onRetryGps,
  onSetManualLocation,
  onNearbyPlacesFound,
  onSelectNearbyPlace,
  onSaveChosenSpot,
}) => {
  const status = useApiLoadingStatus();
  const [droppedPin, setDroppedPin] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [droppedMarkerRef, droppedMarker] = useAdvancedMarkerRef();
  const [recenterSignal, setRecenterSignal] = useState(0);

  const selectedPlace =
    nearbyPlaces.find((p) => p.id === selectedPlaceId) ?? null;

  const handleMapClick = useCallback(
    (ev: { detail: { latLng?: { lat: number; lng: number } | null } }) => {
      if (activeSpot) return;
      const latLng = ev.detail?.latLng;
      if (latLng) {
        setDroppedPin({ lat: latLng.lat, lng: latLng.lng });
      }
    },
    [activeSpot]
  );

  // Do not center on any hardcoded fallback city if we don't have currentPosition or activeSpot yet
  if (!currentPosition && !activeSpot) {
    return (
      <LocationWaitCard
        gpsStatus={gpsStatus}
        gpsError={gpsError}
        onRetryGps={onRetryGps}
        onSetManualLocation={onSetManualLocation}
      />
    );
  }

  if (
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE
  ) {
    const dist =
      activeSpot && currentPosition
        ? calculateDistanceMeters(
            currentPosition.latitude,
            currentPosition.longitude,
            activeSpot.latitude,
            activeSpot.longitude
          )
        : null;
    return (
      <SpotMiniMap
        distanceMeters={dist}
        bearingDegrees={null}
        compassHeading={compassHeading}
        unitSystem={unitSystem}
      />
    );
  }

  const initialCenter = activeSpot
    ? { lat: activeSpot.latitude, lng: activeSpot.longitude }
    : {
        lat: currentPosition!.latitude,
        lng: currentPosition!.longitude,
      };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0B0D11]">
      <div className="relative h-[340px] w-full sm:h-[400px]">
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={initialCenter}
          defaultZoom={16}
          gestureHandling="greedy"
          disableDefaultUI={false}
          streetViewControl={false}
          mapTypeControl={false}
          onClick={handleMapClick}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          <MapCameraController
            currentPosition={currentPosition}
            activeSpot={activeSpot}
            selectedPlace={selectedPlace}
            recenterSignal={recenterSignal}
          />
          <NearbyPlacesSearcher
            currentPosition={currentPosition}
            activeSpot={activeSpot}
            onNearbyPlacesFound={onNearbyPlacesFound}
          />
          <WalkingRouteOverlay
            currentPosition={currentPosition}
            activeSpot={activeSpot}
          />

          {/* User's Current Location Marker */}
          {currentPosition && (
            <AdvancedMarker
              position={{
                lat: currentPosition.latitude,
                lng: currentPosition.longitude,
              }}
              title="Your current location"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-600 shadow-md" />
            </AdvancedMarker>
          )}

          {/* Active Parked Vehicle Pin */}
          {activeSpot && (
            <AdvancedMarker
              position={{
                lat: activeSpot.latitude,
                lng: activeSpot.longitude,
              }}
              title={activeSpot.note || 'Your Parked Car'}
            >
              <Pin
                background="#F59E0B"
                borderColor="#FFFFFF"
                glyphColor="#0B0D11"
                glyphText="C"
                scale={1.25}
              />
            </AdvancedMarker>
          )}

          {/* Nearby Available Parking Spots */}
          {!activeSpot &&
            nearbyPlaces.map((place) => (
              <NearbyPlaceMarker
                key={place.id}
                place={place}
                isSelected={selectedPlaceId === place.id}
                unitSystem={unitSystem}
                onSelect={(p) =>
                  onSelectNearbyPlace(p.id ? p : { ...place, id: '' })
                }
                onParkHere={(p) =>
                  onSaveChosenSpot(p.latitude, p.longitude, p.name)
                }
              />
            ))}

          {/* Custom Map Tap Pin before saving */}
          {!activeSpot && droppedPin && (
            <>
              <AdvancedMarker
                ref={droppedMarkerRef}
                position={droppedPin}
                title="Selected Spot"
              >
                <Pin
                  background="#F59E0B"
                  borderColor="#FFFFFF"
                  glyphColor="#0B0D11"
                  glyphText="P"
                />
              </AdvancedMarker>
              {droppedMarker && (
                <InfoWindow
                  anchor={droppedMarker}
                  onCloseClick={() => setDroppedPin(null)}
                >
                  <div className="p-1 text-slate-900">
                    <p className="text-xs font-bold">Custom Parking Pin</p>
                    <button
                      type="button"
                      onClick={() => {
                        onSaveChosenSpot(
                          droppedPin.lat,
                          droppedPin.lng,
                          'Pinned Parking Spot'
                        );
                        setDroppedPin(null);
                      }}
                      className="mt-2 w-full rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
                    >
                      Save This Spot
                    </button>
                  </div>
                </InfoWindow>
              )}
            </>
          )}
        </GoogleMap>

        {currentPosition && (
          <button
            type="button"
            onClick={() => setRecenterSignal((s) => s + 1)}
            aria-label="Center map on my current location"
            className="absolute bottom-3 left-3 z-10 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/15 bg-[#14171D]/95 px-3 text-xs font-semibold text-white shadow-lg backdrop-blur-sm hover:bg-[#1D222B]"
          >
            <LocateFixed className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <span>Center on Me</span>
          </button>
        )}
      </div>

      {/* Clear Map Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#11141A] px-3.5 py-2 text-xs text-[#9CA3AF]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-white bg-blue-600" />
            <span>You</span>
          </span>
          {activeSpot ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              <span>Your Parked Car (C)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              <span>Nearby Parking (P) · Tap map to pin</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const ParkingGoogleMap: React.FC<ParkingGoogleMapProps> = (props) => {
  if (!props.mapsApiKey || props.quotaExceeded) {
    const dist =
      props.activeSpot && props.currentPosition
        ? calculateDistanceMeters(
            props.currentPosition.latitude,
            props.currentPosition.longitude,
            props.activeSpot.latitude,
            props.activeSpot.longitude
          )
        : null;
    const bearing =
      props.activeSpot && props.currentPosition
        ? calculateBearingDegrees(
            props.currentPosition.latitude,
            props.currentPosition.longitude,
            props.activeSpot.latitude,
            props.activeSpot.longitude
          )
        : null;
    return (
      <SpotMiniMap
        distanceMeters={dist}
        bearingDegrees={bearing}
        compassHeading={props.compassHeading}
        unitSystem={props.unitSystem}
      />
    );
  }

  return (
    <APIProvider
      apiKey={props.mapsApiKey}
      libraries={['marker', 'places', 'routes']}
    >
      <InnerGoogleMap
        currentPosition={props.currentPosition}
        gpsStatus={props.gpsStatus}
        gpsError={props.gpsError}
        activeSpot={props.activeSpot}
        nearbyPlaces={props.nearbyPlaces}
        selectedPlaceId={props.selectedPlaceId}
        unitSystem={props.unitSystem}
        compassHeading={props.compassHeading}
        onRetryGps={props.onRetryGps}
        onSetManualLocation={props.onSetManualLocation}
        onNearbyPlacesFound={props.onNearbyPlacesFound}
        onSelectNearbyPlace={props.onSelectNearbyPlace}
        onSaveChosenSpot={props.onSaveChosenSpot}
      />
    </APIProvider>
  );
};

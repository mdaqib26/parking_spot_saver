import React from 'react';
import { ExternalLink, MapPin, Navigation, RefreshCw, Search } from 'lucide-react';
import { UnitSystem } from '../types/parking';
import { buildGoogleMapsUrl, formatDistance } from '../utils/geodesy';
import { NearbyParkingPlace } from './ParkingGoogleMap';

export interface GroundedMapPlace {
  title: string;
  uri: string;
  placeId?: string;
  reviewSnippets?: string[];
}

interface NearbyParkingListProps {
  hasLocation: boolean;
  nearbyPlaces: NearbyParkingPlace[];
  groundedSummary: string;
  groundedPlaces: GroundedMapPlace[];
  isSearching: boolean;
  searchError: string | null;
  searchQuery: string;
  unitSystem: UnitSystem;
  selectedPlaceId: string | null;
  onChangeSearchQuery: (q: string) => void;
  onSearchNearby: () => void;
  onSelectPlace: (place: NearbyParkingPlace) => void;
  onParkAtPlace: (place: NearbyParkingPlace) => void;
}

export const NearbyParkingList: React.FC<NearbyParkingListProps> = ({
  hasLocation,
  nearbyPlaces,
  groundedSummary,
  groundedPlaces,
  isSearching,
  searchError,
  searchQuery,
  unitSystem,
  selectedPlaceId,
  onChangeSearchQuery,
  onSearchNearby,
  onSelectPlace,
  onParkAtPlace,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchNearby();
  };

  return (
    <section
      aria-label="Choose nearby parking spot"
      className="rounded-3xl border border-white/10 bg-[#14171D] p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-white">
            Available Parking Near You
          </h2>
          <p className="mt-0.5 text-xs text-[#9CA3AF]">
            {hasLocation
              ? 'Choose a nearby parking garage or lot near your current location'
              : 'Waiting for your current location to find nearby parking'}
          </p>
        </div>

        <button
          type="button"
          onClick={onSearchNearby}
          disabled={isSearching || !hasLocation}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/10 bg-[#1D222B] px-3 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 text-amber-400 ${isSearching ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>{isSearching ? 'Searching…' : 'Find Near Me'}</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-3.5 flex gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]"
            aria-hidden="true"
          />
          <label htmlFor="parking-area-filter" className="sr-only">
            Filter nearby parking
          </label>
          <input
            id="parking-area-filter"
            type="text"
            value={searchQuery}
            onChange={(e) => onChangeSearchQuery(e.target.value)}
            placeholder="e.g. covered garage, EV, free lot"
            className="min-h-[44px] w-full rounded-xl border border-white/10 bg-[#0B0D11] pl-9 pr-3 text-sm text-white placeholder:text-[#6B7280] focus:border-amber-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isSearching || !hasLocation}
          className="min-h-[44px] rounded-xl bg-amber-500 px-4 text-xs font-bold text-[#0B0D11] hover:bg-amber-400 disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          Search
        </button>
      </form>

      {searchError && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          {searchError}
        </p>
      )}

      {nearbyPlaces.length > 0 && (
        <ul className="mt-4 divide-y divide-white/10">
          {nearbyPlaces.map((place) => {
            const dist =
              typeof place.distanceMeters === 'number'
                ? formatDistance(place.distanceMeters, unitSystem)
                : null;
            const isSelected = selectedPlaceId === place.id;
            return (
              <li key={place.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectPlace(place)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p
                      className={`truncate text-sm font-semibold ${
                        isSelected ? 'text-amber-300' : 'text-white'
                      }`}
                    >
                      {place.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[#9CA3AF]">
                      {dist ? `${dist.value} ${dist.label} away` : 'Nearby'}
                      {place.address ? ` · ${place.address}` : ''}
                    </p>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={buildGoogleMapsUrl(place.latitude, place.longitude)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Directions to ${place.name}`}
                      className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl border border-white/10 bg-[#1D222B] text-[#D1D5DB] hover:bg-white/10"
                    >
                      <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                    <button
                      type="button"
                      onClick={() => onParkAtPlace(place)}
                      className="min-h-[38px] rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 whitespace-nowrap"
                    >
                      Park Here
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(groundedSummary || groundedPlaces.length > 0) && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-xs font-semibold text-amber-400">
            Google Maps Live Parking Info
          </p>
          {groundedSummary && (
            <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-[#D1D5DB]">
              {groundedSummary}
            </p>
          )}

          {groundedPlaces.length > 0 && (
            <div className="mt-3 space-y-2">
              {groundedPlaces.map((gp, idx) => (
                <a
                  key={`${gp.uri}-${idx}`}
                  href={gp.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0B0D11] px-3 py-2 text-xs font-medium text-white transition-colors hover:border-amber-500/40 hover:bg-[#1D222B]"
                >
                  <span className="flex items-center gap-2 truncate">
                    <MapPin
                      className="h-3.5 w-3.5 shrink-0 text-emerald-400"
                      aria-hidden="true"
                    />
                    <span className="truncate">{gp.title}</span>
                  </span>
                  <ExternalLink
                    className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]"
                    aria-hidden="true"
                  />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

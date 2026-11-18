import React from 'react';
import { MapPin, Navigation, RotateCcw, Trash2, X } from 'lucide-react';
import { ParkingSpot } from '../types/parking';
import { buildGoogleMapsUrl, formatDurationSpan } from '../utils/geodesy';

interface HistoryViewProps {
  isOpen: boolean;
  onClose: () => void;
  history: ParkingSpot[];
  onRestoreSpot: (spot: ParkingSpot) => void;
  onDeleteSpot: (id: string) => void;
  onClearHistory: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  isOpen,
  onClose,
  history,
  onRestoreSpot,
  onDeleteSpot,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
    >
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#14171D] p-5 sm:rounded-3xl sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2
            id="history-modal-title"
            className="font-display text-lg font-bold text-white"
          >
            Past Parking Spots ({history.length})
          </h2>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                type="button"
                onClick={onClearHistory}
                className="min-h-[40px] rounded-xl px-2.5 text-xs font-medium text-[#9CA3AF] hover:bg-white/5 hover:text-red-300"
              >
                Clear All
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close history"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#9CA3AF] hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-[#0B0D11] p-6 text-center">
            <MapPin className="mx-auto h-6 w-6 text-[#9CA3AF]" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-white">
              No past spots saved yet
            </p>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              Spots you clear will appear here for easy reuse.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/10">
            {history.map((spot) => (
              <li key={spot.id} className="py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  {spot.photoDataUrl ? (
                    <img
                      src={spot.photoDataUrl}
                      alt={spot.note || 'Past parking spot'}
                      referrerPolicy="no-referrer"
                      className="h-12 w-12 shrink-0 rounded-xl border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#1D222B] text-amber-400">
                      <MapPin className="h-5 w-5" aria-hidden="true" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {spot.note.trim() || 'Saved Parking Spot'}
                    </p>
                    <p className="mt-0.5 text-xs text-[#9CA3AF]">
                      {new Date(spot.savedAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      ·{' '}
                      {new Date(spot.savedAt).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {spot.endedAt
                        ? ` · ${formatDurationSpan(spot.savedAt, spot.endedAt)}`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={buildGoogleMapsUrl(spot.latitude, spot.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#1D222B] px-3 text-xs font-semibold text-white hover:bg-white/10 whitespace-nowrap"
                  >
                    <Navigation className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                    <span>Navigate</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      onRestoreSpot(spot);
                      onClose();
                    }}
                    className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 whitespace-nowrap"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Use Spot</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSpot(spot.id)}
                    aria-label="Delete spot"
                    className="flex min-h-[40px] min-w-[44px] items-center justify-center rounded-xl border border-white/10 bg-[#1D222B] text-[#9CA3AF] hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

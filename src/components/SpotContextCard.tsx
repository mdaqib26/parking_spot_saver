import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Maximize2, Trash2, X } from 'lucide-react';
import { compressImageFile } from '../utils/media';

interface SpotContextCardProps {
  note: string;
  photoDataUrl?: string;
  onChangeNote: (note: string) => void;
  onChangePhoto: (photoDataUrl: string | undefined) => void;
  label?: string;
}

export const SpotContextCard: React.FC<SpotContextCardProps> = ({
  note,
  photoDataUrl,
  onChangeNote,
  onChangePhoto,
  label = 'Add a note or photo',
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const [imgBroken, setImgBroken] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    setImgBroken(false);
    setIsCompressing(true);
    try {
      const compressed = await compressImageFile(file, 720, 0.72);
      onChangePhoto(compressed);
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : 'Could not load selected photo.'
      );
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#14171D] p-4">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor="parking-note-field"
          className="text-sm font-semibold text-white"
        >
          {label}
        </label>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isCompressing}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/10 bg-[#1D222B] px-3 text-xs font-semibold text-white transition-colors hover:bg-white/10 active:scale-[0.98] whitespace-nowrap shrink-0 disabled:opacity-60"
        >
          <Camera className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <span>
            {isCompressing
              ? 'Saving…'
              : photoDataUrl
                ? 'Change Photo'
                : 'Take Photo'}
          </span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Take or upload parking spot photo"
        />
      </div>

      <input
        id="parking-note-field"
        type="text"
        value={note}
        onChange={(e) => onChangeNote(e.target.value)}
        maxLength={120}
        placeholder="e.g. Level 2, pillar B"
        className="mt-3 min-h-[46px] w-full rounded-xl border border-white/10 bg-[#0B0D11] px-3.5 text-sm text-white placeholder:text-[#6B7280] focus:border-amber-500 focus:outline-none"
      />

      {photoError && (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {photoError}
        </p>
      )}

      {photoDataUrl && (
        <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-[#0B0D11]">
          {!imgBroken ? (
            <div className="relative">
              <img
                src={photoDataUrl}
                alt={note ? `Parking note: ${note}` : 'Parking spot photo'}
                referrerPolicy="no-referrer"
                onError={() => setImgBroken(true)}
                className="h-44 w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2.5">
                <button
                  type="button"
                  onClick={() => setShowLightbox(true)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-black/65 px-3 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/85"
                >
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>View Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangePhoto(undefined)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-black/65 px-3 text-xs font-medium text-red-300 backdrop-blur-sm hover:bg-red-500/30"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-28 flex-col items-center justify-center gap-1.5 text-xs text-[#9CA3AF]">
              <ImageIcon className="h-5 w-5" aria-hidden="true" />
              <span>Photo unavailable</span>
            </div>
          )}
        </div>
      )}

      {showLightbox && photoDataUrl && !imgBroken && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Full size parking photo"
        >
          <div className="relative w-full max-w-xl">
            <button
              type="button"
              onClick={() => setShowLightbox(false)}
              aria-label="Close photo"
              className="absolute right-3 top-3 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={photoDataUrl}
              alt={note ? `Parking note: ${note}` : 'Parking spot photo'}
              referrerPolicy="no-referrer"
              className="max-h-[80vh] w-full rounded-2xl object-contain"
            />
            {note && (
              <p className="mt-3 text-center text-sm font-medium text-white">
                {note}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

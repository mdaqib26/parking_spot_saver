import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 active:scale-[0.98] whitespace-nowrap shrink-0"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-[#11161D] px-3.5 py-2 text-xs font-medium text-[#F4F7FB] transition-colors hover:bg-[#18202B] active:scale-[0.98] whitespace-nowrap shrink-0"
        >
          <Share className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#11161D] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <h3
                  id="ios-install-title"
                  className="font-display text-lg font-semibold text-[#F4F7FB]"
                >
                  Install SpotLock on iPhone
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install instructions"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#8B95A5] hover:bg-white/5 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#8B95A5]">
                Add SpotLock to your home screen for full-screen offline access inside parking garages.
              </p>
              <ol className="mt-4 space-y-3 text-sm text-[#F4F7FB]">
                <li className="flex items-center gap-3">
                  <span className="font-mono-tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#18202B] text-xs font-semibold text-amber-400">
                    1
                  </span>
                  <span>
                    Tap the <strong className="font-semibold">Share</strong> button in Safari&apos;s toolbar.
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="font-mono-tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#18202B] text-xs font-semibold text-amber-400">
                    2
                  </span>
                  <span>
                    Scroll down and tap <strong className="font-semibold">Add to Home Screen</strong>.
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full min-h-[48px] rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-[#090C10] transition-colors hover:bg-amber-400 active:scale-[0.98]"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

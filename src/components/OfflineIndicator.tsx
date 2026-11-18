import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-40 mx-auto flex max-w-md items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-[#14171D]/95 px-4 py-2.5 text-xs font-medium text-amber-200 shadow-lg backdrop-blur-md"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
      <span>Offline Mode — Saved parking spot remains available.</span>
    </div>
  );
};

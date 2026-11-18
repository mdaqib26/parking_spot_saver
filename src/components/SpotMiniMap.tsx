import React from 'react';
import { Car, Navigation } from 'lucide-react';
import { UnitSystem } from '../types/parking';
import { cardinalDirection, formatDistance } from '../utils/geodesy';

interface SpotMiniMapProps {
  distanceMeters: number | null;
  bearingDegrees: number | null;
  compassHeading: number | null;
  unitSystem: UnitSystem;
}

export const SpotMiniMap: React.FC<SpotMiniMapProps> = ({
  distanceMeters,
  bearingDegrees,
  compassHeading,
  unitSystem,
}) => {
  const formatted =
    distanceMeters !== null ? formatDistance(distanceMeters, unitSystem) : null;
  const isArrived = distanceMeters !== null && distanceMeters < 15;

  const angleDeg =
    bearingDegrees !== null
      ? compassHeading !== null
        ? (bearingDegrees - compassHeading + 360) % 360
        : bearingDegrees
      : 45;

  // Position car pin along direction vector from center ("You")
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const radius = isArrived ? 26 : 68;
  const carX = 160 + Math.cos(rad) * radius;
  const carY = 95 + Math.sin(rad) * radius * 0.72;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0B0D11]">
      <svg
        viewBox="0 0 320 190"
        className="block h-44 w-full select-none"
        aria-hidden="true"
      >
        {/* Subtle map grid */}
        <defs>
          <pattern
            id="spot-grid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 24 0 L 0 0 0 24"
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="320" height="190" fill="url(#spot-grid)" />

        {/* Subtle road blocks */}
        <rect
          x="20"
          y="22"
          width="88"
          height="52"
          rx="8"
          fill="rgba(255,255,255,0.025)"
        />
        <rect
          x="212"
          y="112"
          width="88"
          height="56"
          rx="8"
          fill="rgba(255,255,255,0.025)"
        />

        {/* Walking path line from You (center) to Car */}
        {distanceMeters !== null && (
          <line
            x1="160"
            y1="95"
            x2={carX}
            y2={carY}
            stroke={isArrived ? '#10B981' : '#F59E0B'}
            strokeWidth="2.5"
            strokeDasharray="6 5"
            strokeLinecap="round"
          />
        )}

        {/* User current location marker (center) */}
        <circle cx="160" cy="95" r="14" fill="rgba(59,130,246,0.2)" />
        <circle
          cx="160"
          cy="95"
          r="6.5"
          fill="#3B82F6"
          stroke="#FFFFFF"
          strokeWidth="2"
        />

        {/* Parked car pin */}
        <g transform={`translate(${carX}, ${carY})`}>
          <circle
            cx="0"
            cy="0"
            r="16"
            fill={isArrived ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}
          />
          <circle
            cx="0"
            cy="0"
            r="11"
            fill={isArrived ? '#10B981' : '#F59E0B'}
          />
        </g>
      </svg>

      {/* Clean Legend Overlay */}
      <div className="flex items-center justify-between border-t border-white/10 bg-[#11141A] px-3.5 py-2 text-xs text-[#9CA3AF]">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span>You</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Car className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            <span>Parked Car</span>
          </span>
        </div>

        <span className="font-mono-tabular inline-flex items-center gap-1 font-semibold text-white">
          <Navigation className="h-3 w-3 text-amber-400" aria-hidden="true" />
          {formatted
            ? `${formatted.value} ${formatted.label}${
                bearingDegrees !== null
                  ? ` ${cardinalDirection(bearingDegrees)}`
                  : ''
              }`
            : 'Locating…'}
        </span>
      </div>
    </div>
  );
};

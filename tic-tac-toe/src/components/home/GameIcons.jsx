// # Filename: src/components/home/GameIcons.jsx
import React from "react";

export function TicTacToeIcon({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <g stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" strokeLinecap="round">
        <line x1="9" y1="2" x2="9" y2="22" />
        <line x1="15" y1="2" x2="15" y2="22" />
        <line x1="2" y1="9" x2="22" y2="9" />
        <line x1="2" y1="15" x2="22" y2="15" />
      </g>
      {/* X — top-left cell */}
      <g stroke="#FB7185" strokeWidth="1.8" strokeLinecap="round">
        <line x1="4" y1="4" x2="7" y2="7" />
        <line x1="7" y1="4" x2="4" y2="7" />
      </g>
      {/* O — bottom-right cell */}
      <circle cx="18.5" cy="18.5" r="2.1" stroke="#22D3EE" strokeWidth="1.8" />
    </svg>
  );
}

export function ConnectFourIcon({ size = 20, className = "" }) {
  const blue = "#3B82F6";
  const red = "#EF4444";
  const empty = "currentColor";
  // 4 columns x 3 rows, bottom-heavy like dropped discs
  const rows = [
    [empty, empty, empty, empty],
    [empty, red, blue, empty],
    [blue, red, blue, red],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="1.5" y="1.5" width="21" height="21" rx="3" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      {rows.map((row, r) =>
        row.map((color, c) => (
          <circle
            key={`${r}-${c}`}
            cx={4.5 + c * 5}
            cy={4.5 + r * 5}
            r="1.7"
            fill={color === empty ? "none" : color}
            stroke={color === empty ? "currentColor" : "none"}
            strokeOpacity={color === empty ? 0.25 : 1}
          />
        ))
      )}
    </svg>
  );
}

export function SudokuIcon({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="1.5" y="1.5" width="21" height="21" rx="3" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <g stroke="currentColor" strokeOpacity="0.25" strokeWidth="1">
        <line x1="8.5" y1="1.5" x2="8.5" y2="22.5" />
        <line x1="15.5" y1="1.5" x2="15.5" y2="22.5" />
        <line x1="1.5" y1="8.5" x2="22.5" y2="8.5" />
        <line x1="1.5" y1="15.5" x2="22.5" y2="15.5" />
      </g>
      <text x="5" y="7.5" fontSize="5" fontWeight="700" fill="#22D3EE" textAnchor="middle">5</text>
      <text x="19" y="14.2" fontSize="5" fontWeight="700" fill="#A78BFA" textAnchor="middle">3</text>
      <text x="12" y="21" fontSize="5" fontWeight="700" fill="currentColor" fillOpacity="0.5" textAnchor="middle">8</text>
    </svg>
  );
}

export function CheckersIcon({ size = 20, className = "" }) {
  const red = "#EF4444";
  const blue = "#3B82F6";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="1.5" y="1.5" width="21" height="21" rx="3" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      {Array.from({ length: 4 }).map((_, row) =>
        Array.from({ length: 4 }).map((__, col) => (
          <rect
            key={`${row}-${col}`}
            x={2.5 + col * 5}
            y={2.5 + row * 5}
            width="5"
            height="5"
            fill={(row + col) % 2 === 0 ? "currentColor" : "transparent"}
            opacity={(row + col) % 2 === 0 ? 0.16 : 1}
          />
        ))
      )}
      <circle cx="7" cy="7" r="2" fill={blue} />
      <circle cx="17" cy="7" r="2" fill={blue} />
      <circle cx="7" cy="17" r="2" fill={red} />
      <circle cx="17" cy="17" r="2" fill={red} />
    </svg>
  );
}

export function PokerIcon({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="4" y="3" width="12" height="17" rx="2" fill="#F8FAFC" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.3" />
      <rect x="8" y="5" width="12" height="17" rx="2" fill="#E2E8F0" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.3" />
      <path d="M14 10.5c1.9-2.7 5.5-.2 3.3 2.4L14 17l-3.3-4.1c-2.2-2.6 1.4-5.1 3.3-2.4Z" fill="#EF4444" />
      <circle cx="8" cy="7" r="1.3" fill="#0F172A" />
      <circle cx="8" cy="16" r="1.3" fill="#0F172A" />
    </svg>
  );
}

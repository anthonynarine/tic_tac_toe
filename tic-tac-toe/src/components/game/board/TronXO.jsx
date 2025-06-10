// File: TronXO.jsx
import React from "react";
import "./TronXO.css"; // 👈 CSS will handle glow + animation

export const XIcon = () => (
  <svg viewBox="0 0 100 100" className="tron-x">
    <line x1="10" y1="10" x2="90" y2="90" />
    <line x1="90" y1="10" x2="10" y2="90" />
  </svg>
);

export const OIcon = () => (
  <svg viewBox="0 0 100 100" className="tron-o-core">
    {/* Outer dashed ring */}
    <circle
      cx="50"
      cy="50"
      r="40"
      stroke="#00e0ff"
      strokeWidth="8"
      fill="none"
      strokeDasharray="6 1"
    />


    {/* Glow filter definition */}
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  </svg>
);

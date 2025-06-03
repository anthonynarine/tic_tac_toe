import React from "react";

/**
 * GlowingSocialIcon
 * ------------------
 * A Tron-styled SVG React component that visually represents a social feature.
 * Contains user circles + chat/connection hybrid and neon glow filter.
 *
 * @returns {JSX.Element} Glowing blue SVG icon for social UI elements
 */
const GlowingSocialIcon = () => (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Outer Glow Circle */}
        <circle cx="24" cy="24" r="22" stroke="#00bfff" strokeWidth="2" fill="none" 
        filter="url(#glowFilter)" />

        {/* Inner Symbol: People/Chat hybrid */}
        <path d="M15 20C17.2091 20 19 18.2091 19 16C19 13.7909 17.2091 12 15 12C12.7909 12 11 13.7909 11 16C11 18.2091 12.7909 20 15 20Z" 
            stroke="#00f7ff" strokeWidth="2"/>
        <path d="M33 20C35.2091 20 37 18.2091 37 16C37 13.7909 35.2091 12 33 12C30.7909 12 29 13.7909 29 16C29 18.2091 30.7909 20 33 20Z" 
            stroke="#00f7ff" strokeWidth="2"/>
        <path d="M24 34C27.866 34 32 30 32 26C32 23 29 22 24 22C19 22 16 23 16 26C16 30 20.134 34 24 34Z"
            stroke="#00ffff" strokeWidth="2"/>

        {/* Glow Filter Definition */}
        <defs>
        <filter id="glowFilter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
            </feMerge>
        </filter>
        </defs>
    </svg>
);

export default GlowingSocialIcon;

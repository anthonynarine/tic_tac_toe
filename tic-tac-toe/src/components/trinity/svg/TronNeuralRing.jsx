// File: components/svg/TronNeuralRing.jsx

import React from "react";

const TronNeuralRing = ({ className }) => (
    <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#A78BFA" stopOpacity="1" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="180" fill="url(#glow)" opacity="0.25" />
        <g transform="translate(200,200)">
        <g>
            <circle
            r="120"
            stroke="#A78BFA"
            strokeWidth="2"
            fill="none"
            strokeDasharray="15 5"
            >
            <animateTransform
                attributeName="transform"
                type="rotate"
                from="0"
                to="360"
                dur="10s"
                repeatCount="indefinite"
            />
            </circle>
            <circle
            r="90"
            stroke="#C4B5FD"
            strokeWidth="1"
            fill="none"
            strokeDasharray="5 3"
            >
            <animateTransform
                attributeName="transform"
                type="rotate"
                from="360"
                to="0"
                dur="7s"
                repeatCount="indefinite"
            />
            </circle>
        </g>
        <circle r="5" fill="#A78BFA">
            <animate
            attributeName="r"
            values="5;8;5"
            dur="2s"
            repeatCount="indefinite"
            />
        </circle>
        </g>
    </svg>
);

export default TronNeuralRing;

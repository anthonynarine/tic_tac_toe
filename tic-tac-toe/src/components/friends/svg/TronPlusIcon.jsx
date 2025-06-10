// File: TronPlusIcon.jsx
const TronPlusIcon = ({ size = 24, onClick }) => (
  <svg
    onClick={onClick}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    style={{ cursor: "pointer" }}
    xmlns="http://www.w3.org/2000/svg"
    className="tron-plus-icon"
  >
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <path
      d="M12 5v14M5 12h14"
      stroke="#00ffff"
      strokeWidth="2.5"
      strokeLinecap="round"
      filter="url(#glow)"
    >
      <animate
        attributeName="stroke"
        values="#00ffff;#0ff;#00ffff"
        dur="2s"
        repeatCount="indefinite"
      />
    </path>
  </svg>
);

export default TronPlusIcon;

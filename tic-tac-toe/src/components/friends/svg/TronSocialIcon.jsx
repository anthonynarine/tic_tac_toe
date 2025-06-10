// ✅ New Code
// Filename: TronSocialIcon.jsx

const TronSocialIcon = ({ size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Outer glow circle */}
    <circle
      cx="32"
      cy="32"
      r="30"
      stroke="cyan"
      strokeWidth="2"
      fill="none"
      style={{ filter: "drop-shadow(0 0 6px #00ffff)" }}
    />

    {/* Head */}
    <circle
      cx="32"
      cy="24"
      r="8"
      fill="#00ffff"
      stroke="cyan"
      strokeWidth="1"
    />

    {/* Shoulders */}
    <path
      d="M16 48c0-8.837 7.163-16 16-16s16 7.163 16 16"
      stroke="cyan"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default TronSocialIcon;

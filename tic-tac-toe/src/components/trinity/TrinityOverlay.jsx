// # Filename: src/components/trinity/TrinityOverlay.jsx
// ✅ New Code

import React, { useCallback } from "react";
import { FaRobot } from "react-icons/fa";
import TrinityQuote from "./TrinityQuote";
import styles from "./TrinityOverlay.module.css";

import useSound from "use-sound";
import bootSound from "./sounds/bootSound.mp3";

export default function TrinityOverlay({ onClick }) {
  const [playBoot] = useSound(bootSound, { volume: 0.35 });

  const handleClick = useCallback(() => {
    playBoot();
    if (typeof onClick === "function") onClick();
  }, [playBoot, onClick]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" || e.key === " ") handleClick();
    },
    [handleClick]
  );

  return (
    <div
      className={styles.avatarContainer}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Open Trinity assistant"
      title="Talk to Trinity"
    >
      <div className={styles.glowRing} aria-hidden="true">
        <FaRobot className={styles.icon} />
      </div>

      <TrinityQuote />
    </div>
  );
}

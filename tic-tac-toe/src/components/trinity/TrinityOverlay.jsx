// File: TrinityOverlay.jsx
import React from "react";
import { FaRobot } from "react-icons/fa";
import TrinityQuote from "./TrinityQuote";
import styles from "./TrinityOverlay.module.css";

import useSound from "use-sound";
import bootSound from "./sounds/bootSound.mp3";
import { useUI } from "../context/uiContext";

/**
 * TrinityOverlay
 * Floating assistant avatar with Matrix aesthetic and sound.
 */
const TrinityOverlay = ({ onClick }) => {
  const [playBoot] = useSound(bootSound, { volume: 0.4 });
  const { setTrinityOpen } = useUI();

  const handleClick = () => {
    playBoot(); // 🔊 play the boot sound
    setTrinityOpen(true);
  };

  return (
    <div className={styles.avatarContainer} onClick={handleClick} title="Talk to Trinity">
      <div className={styles.glowRing}>
        <FaRobot className={styles.icon} />
      </div>
      {/* <span className={styles.caption}>Trinity</span> */}
      <TrinityQuote />
    </div>
  );
};

export default TrinityOverlay;

// # Filename: src/components/trinity/TrinityUI.jsx
// ✅ New Code

import React from "react";
import TrinityOverlay from "./TrinityOverlay";
import TrinityDrawer from "./TrinityDrawer";
import { useLocation } from "react-router-dom";
import { useUI } from "../context/uiContext";

const TrinityUI = () => {
  const { setTrinityOpen } = useUI();
  const location = useLocation();

  // Step 1: Only hide on isolated technical paper route (optional)
  const isHidden = location.pathname === "/technical-paper";
  if (isHidden) return null;

  return (
    <>
      <TrinityOverlay onClick={() => setTrinityOpen(true)} />
      {/* TrinityDrawer reads from context; props here are ignored */}
      <TrinityDrawer />
    </>
  );
};

export default TrinityUI;

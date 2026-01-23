// # Filename: src/components/layout/AppShell.jsx
// ✅ New Code

import React from "react";
import "./layout.css";
import TrinityDrawer from "../components/trinity/TrinityDrawer";
import { useUI } from "../components/context/uiContext";

const AppShell = ({ children }) => {
  const { isTrinityOpen } = useUI();

  return (
    <div className="app-shell">
      {children}

      {/* ✅ Drawer mounted once at the root */}
      {isTrinityOpen && <TrinityDrawer />}
    </div>
  );
};

export default AppShell;

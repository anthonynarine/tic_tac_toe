// # Filename: src/components/context/uiContext.jsx
// ✅ New Code

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";

const UIContext = createContext();

/**
 * useUI
 * React hook to access the UI context from any component.
 * @returns {{
 *   isSidebarOpen: boolean,
 *   setSidebarOpen: function,
 *   isDMOpen: boolean,
 *   setDMOpen: function,
 *   isTrinityOpen: boolean,
 *   setTrinityOpen: function
 * }}
 */
export const useUI = () => useContext(UIContext);

/**
 * UIProvider
 *
 * Global UI state manager for modals, drawers, and contextual UI overlays.
 * Manages:
 * - Friends Sidebar drawer
 * - Direct Message drawer
 * - Trinity AI Assistant drawer
 *
 * IMPORTANT CHANGE:
 * - Trinity should be available across the app (including games/lobby),
 *   since it’s your docs/assistant tool.
 * - We keep `/technical-paper` isolated (App.jsx already isolates it),
 *   so we guard only that route for safety.
 */
export const UIProvider = ({ children }) => {
  // Step 1: Friends Sidebar
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // Step 2: Direct Messages Drawer
  const [isDMOpen, setDMOpen] = useState(false);

  // Step 3: Trinity Assistant Drawer
  const [isTrinityOpen, setTrinityOpen] = useState(false);

  const location = useLocation();

  // Step 4: Auto-close drawers only on the isolated Technical Paper route
  useEffect(() => {
    if (location.pathname === "/technical-paper") {
      setDMOpen(false);
      setTrinityOpen(false);
    }
  }, [location.pathname]);

  // Step 5: Prevent DM drawer from opening only on /technical-paper
  const safeSetDMOpen = useCallback(
    (state) => {
      if (location.pathname !== "/technical-paper") {
        setDMOpen(state);
      }
    },
    [location.pathname]
  );

  // Step 6: Allow Trinity everywhere except /technical-paper
  // (Your previous guard blocked /games and /lobby, which is why clicking Trinity
  // in the navbar “did nothing” on those pages.)【:contentReference[oaicite:0]{index=0}】
  const safeSetTrinityOpen = useCallback(
    (state) => {
      const restricted = location.pathname === "/technical-paper";
      if (!restricted) {
        setTrinityOpen(state);
      }
    },
    [location.pathname]
  );

  return (
    <UIContext.Provider
      value={{
        isSidebarOpen,
        setSidebarOpen,
        isDMOpen,
        setDMOpen: safeSetDMOpen,
        isTrinityOpen,
        setTrinityOpen: safeSetTrinityOpen,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

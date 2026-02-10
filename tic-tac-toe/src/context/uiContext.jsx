// ✅ New Code
// # Filename: src/context/uiContext.jsx

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";

const UIContext = createContext(null);

export const useUI = () => useContext(UIContext);

export const UIProvider = ({ children }) => {
  // # Step 1: Friends Sidebar (mobile drawer) should default CLOSED
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // # Step 2: Direct Messages Drawer
  const [isDMOpen, setDMOpen] = useState(false);

  // # Step 3: Trinity Assistant Drawer
  const [isTrinityOpen, setTrinityOpen] = useState(false);

  const location = useLocation();

  // # Step 4: Force-close sidebar on initial mount for < lg screens
  // Prevents "auto-open" even if stale state or another file ever sets it.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)"); // lg breakpoint

    const sync = () => {
      if (!mq.matches) {
        setSidebarOpen(false);
      }
    };

    sync();
    mq.addEventListener("change", sync);

    return () => mq.removeEventListener("change", sync);
  }, []);

  // # Step 5: Auto-close drawers only on the isolated Technical Paper route
  useEffect(() => {
    if (location.pathname === "/technical-paper") {
      setSidebarOpen(false);
      setDMOpen(false);
      setTrinityOpen(false);
    }
  }, [location.pathname]);

  // # Step 6: On navigation, close the mobile sidebar (prevents “stays open after clicking a link”)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    if (!mq.matches) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  // # Step 7: Prevent DM drawer from opening only on /technical-paper
  const safeSetDMOpen = useCallback(
    (state) => {
      if (location.pathname !== "/technical-paper") {
        setDMOpen(state);
      }
    },
    [location.pathname]
  );

  // # Step 8: Allow Trinity everywhere except /technical-paper
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

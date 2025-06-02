// uiContext.jsx
import { createContext, useContext, useState, useEffect } from "react";
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
 * Guards Trinity and DM drawers from opening on restricted routes like `/technical-paper` or `/games/:id`.
 */
export const UIProvider = ({ children }) => {
    // 🎮 Friends Sidebar
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    // 💬 Direct Messages Drawer
    const [isDMOpen, setDMOpen] = useState(false);

    // 🤖 Trinity Assistant Drawer
    const [isTrinityOpen, setTrinityOpen] = useState(false);

    const location = useLocation();

    /**
     * 🚨 Auto-close restricted drawers when navigating to blocked routes
     * Trinity and DM drawers are not allowed on certain screens (like `/technical-paper`)
     */
    useEffect(() => {
        if (location.pathname === "/technical-paper") {
        setDMOpen(false);
        setTrinityOpen(false);
        }
        if (location.pathname.includes("/games/") || location.pathname.includes("/lobby/")) {
        setTrinityOpen(false);
        }
    }, [location.pathname]);

    /**
     * 👮 safeSetDMOpen
     * Prevents DM drawer from opening on restricted pages
     * @param {boolean} state - open/close state
     */
    const safeSetDMOpen = (state) => {
        if (location.pathname !== "/technical-paper") {
        setDMOpen(state);
        }
    };

    /**
     * 👮 safeSetTrinityOpen
     * Prevents Trinity assistant from opening on restricted pages (game/lobby/technical-paper)
     * @param {boolean} state - open/close state
     */
    const safeSetTrinityOpen = (state) => {
        const restricted =
        location.pathname === "/technical-paper" ||
        location.pathname.includes("/games/") ||
        location.pathname.includes("/lobby/");
        if (!restricted) {
        setTrinityOpen(state);
        }
    };

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

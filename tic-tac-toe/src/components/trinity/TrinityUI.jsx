// TrinityUI.jsx
import React from "react";
import TrinityOverlay from "./TrinityOverlay";
import TrinityDrawer from "./TrinityDrawer";
import { useLocation } from "react-router-dom";
import { useUI } from "../context/uiContext";

/**
 * 🤖 TrinityUI
 * Global wrapper for:
 * - Floating assistant avatar
 * - Slide-down assistant drawer
 *
 * Automatically hides Trinity on restricted routes like games, lobby, and paper view.
 */
const TrinityUI = () => {
    const { isTrinityOpen, setTrinityOpen } = useUI();
    const location = useLocation();

    const isHidden =
        location.pathname === "/technical-paper" ||
        location.pathname.includes("/games/") ||
        location.pathname.includes("/lobby/");

    if (isHidden) return null;

    return (
        <>
        <TrinityOverlay onClick={() => setTrinityOpen(true)} />
        <TrinityDrawer isOpen={isTrinityOpen} onClose={() => setTrinityOpen(false)} />
        </>
    );
};

export default TrinityUI;

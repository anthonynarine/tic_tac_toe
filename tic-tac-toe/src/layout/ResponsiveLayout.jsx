// components/layout/ResponsiveLayout.jsx

import React from "react";
import MainRoutes from "../routes/MainRoutes";
import FriendsSidebar from "../components/friends/FriendsSidebar";
import DMDrawer from "../components/friends/DMDrawer";

import useIsDesktop from "../components/hooks/useIsDesktop";
import { useUI } from "../components/context/uiContext";
import { useUserContext } from "../components/context/userContext";

/**
 * ResponsiveLayout
 *
 * This component orchestrates the main layout structure of the app based on screen size.
 * - Renders `FriendsSidebar` and `DMDrawer` for logged-in users only
 * - On mobile/tablet, these are toggleable (slide-in)
 * - On desktop, they're statically visible
 *
 * Automatically adapts to login state and avoids rendering
 * sidebar components without their required providers.
 *
 * @returns {JSX.Element} Responsive container for sidebar + main routes
 */
const ResponsiveLayout = () => {
    const isDesktop = useIsDesktop(); // Media query check for screen size
    const {
        isSidebarOpen,
        setSidebarOpen,
        isDMOpen,
        setDMOpen
    } = useUI(); // UI state from context
    const { isLoggedIn } = useUserContext(); // Prevents rendering if not logged in

    return (
        <div className={`frame-body ${isDesktop && isDMOpen ? 'dm-drawer-open' : ''}`}>
        {isDesktop ? (
            <>
            {/* Desktop layout: sidebar always visible */}
            {isLoggedIn && <FriendsSidebar />}
            <div className="main-content">
                <MainRoutes />
            </div>
            {isLoggedIn && (
                <DMDrawer isOpen={isDMOpen} onClose={() => setDMOpen(false)} />
            )}
            </>
        ) : (
            <>
            {/* Mobile/tablet layout: toggled sidebar and drawer */}
            {isSidebarOpen && isLoggedIn && (
                <>
                <div
                    className="sidebar-backdrop"
                    onClick={() => setSidebarOpen(false)}
                />
                <FriendsSidebar />
                </>
            )}
            <div className="main-content">
                <MainRoutes />
            </div>
            {isLoggedIn && (
                <DMDrawer isOpen={isDMOpen} onClose={() => setDMOpen(false)} />
            )}
            </>
        )}
        </div>
    );
};


export default ResponsiveLayout;

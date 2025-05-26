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
  const { isSidebarOpen, setSidebarOpen } = useUI(); // Controls mobile sidebar visibility
  const { isLoggedIn } = useUserContext(); // Prevents crashes if user is logged out

    return (
        <div className="frame-body">
        {isDesktop ? (
            <>
            {/* Desktop layout: sidebar always visible if logged in */}
            {isLoggedIn && <FriendsSidebar />}
            <MainRoutes />
            {isLoggedIn && <DMDrawer isOpen onClose={() => {}} />}
            </>
        ) : (
            <>
            {/* Mobile/Tablet layout: sidebar toggled via UI context */}
            {isSidebarOpen && isLoggedIn && (
                <>
                <div
                    className="sidebar-backdrop"
                    onClick={() => setSidebarOpen(false)}
                />
                <FriendsSidebar />
                </>
            )}
            <MainRoutes />
            {isLoggedIn && <DMDrawer isOpen onClose={() => {}} />}
            </>
        )}
        </div>
    );
};

export default ResponsiveLayout;

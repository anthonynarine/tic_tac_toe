// components/layout/ResponsiveLayout.jsx

import React from "react";
import MainRoutes from "../routes/MainRoutes";
import FriendsSidebar from "../components/friends/FriendsSidebar";
import DMDrawer from "../components/messaging/DMDrawer/DMDrawer";
import useIsDesktop from "../components/hooks/ui/useIsDesktop";
import { useUI } from "../components/context/uiContext";
import { useUserContext } from "../components/context/userContext";

/**
 * ResponsiveLayout
 *
 * Handles responsive rendering of the FriendsSidebar, MainRoutes, and DMDrawer
 * depending on screen size and UI state.
 *
 * Desktop:
 *   - FriendsSidebar always visible
 *   - DMDrawer slides in
 *
 * Tablet/Mobile:
 *   - Only Sidebar or MainRoutes is visible at one time
 *   - Sidebar takes over full screen
 *
 * @returns {JSX.Element}
 */
const ResponsiveLayout = () => {
    const isDesktop = useIsDesktop();
    const {
        isSidebarOpen,
        isDMOpen,
        setDMOpen
    } = useUI();

    const { isLoggedIn } = useUserContext();

    return (
        <div className={`frame-body ${isDesktop && isDMOpen ? "dm-drawer-open" : ""}`}>
            {isDesktop ? (
                <>
                    {/* === 💻 DESKTOP: Sidebar and Main Content Side by Side === */}
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
                    {/* === 📱 MOBILE/TABLET: Sidebar or Main Content === */}
                    {isSidebarOpen && isLoggedIn ? (
                        <div className="friends-sidebar-wrapper">
                            <FriendsSidebar />
                        </div>
                    ) : (
                        <div className="main-content">
                            <MainRoutes />
                        </div>
                    )}
                    {isLoggedIn && (
                        <DMDrawer isOpen={isDMOpen} onClose={() => setDMOpen(false)} />
                    )}
                </>
            )}
        </div>
    );
};

export default ResponsiveLayout;

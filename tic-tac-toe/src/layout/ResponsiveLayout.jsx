// components/layout/ResponsiveLayout.jsx

import React from "react";
import MainRoutes from "../routes/MainRoutes";
import FriendsSidebar from "../components/friends/FriendsSidebar";
import DMDrawer from "../components/friends/DMDrawer";

import useIsDesktop from "../components/hooks/useIsDesktop";
import { useUI } from "../components/context/uiContext"; // ✅ Assuming this manages sidebar open state

const ResponsiveLayout = () => {
    const isDesktop = useIsDesktop();
    const { isSidebarOpen, setSidebarOpen } = useUI();

    return (
        <div className="frame-body">
        {isDesktop ? (
            <>
            <FriendsSidebar />
            <MainRoutes />
            <DMDrawer isOpen onClose={() => {}} />
            </>
        ) : (
            <>
            {isSidebarOpen && (
                <>
                <div
                    className="sidebar-backdrop"
                    onClick={() => setSidebarOpen(false)}
                />
                <FriendsSidebar />
                </>
            )}
            <MainRoutes />
            <DMDrawer isOpen onClose={() => {}} />
            </>
        )}
        </div>
    );
};

export default ResponsiveLayout;

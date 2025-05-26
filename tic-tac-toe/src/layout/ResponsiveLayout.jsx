// components/layout/ResponsiveLayout.jsx

import React from "react";
import MainRoutes from "../routes/MainRoutes";
import FriendsSidebar from "../components/friends/FriendsSidebar"
import DMDrawer from "../components/friends/DMDrawer";

import { useLayoutView } from "../components/hooks/useLayoutView";

/**
 * ResponsiveLayout
 *
 * Central switch for rendering the appropriate view
 * based on screen size and UI state.
 */
const ResponsiveLayout = () => {
    const layout = useLayoutView();

    switch (layout) {
        case "desktop":
        return (
            <div className="frame-body">
            <FriendsSidebar />
            <MainRoutes />
            <DMDrawer isOpen onClose={() => {}} />
            </div>
        );
        case "sidebar":
        return <FriendsSidebar />;
        case "drawer":
        return <DMDrawer isOpen onClose={() => {}} />;
        default:
        return <MainRoutes />;
    }
};

export default ResponsiveLayout;
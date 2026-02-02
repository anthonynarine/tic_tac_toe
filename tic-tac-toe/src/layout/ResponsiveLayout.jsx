// # Filename: src/layout/ResponsiveLayout.jsx
// ✅ Updated: remove md:pl-[var(--sidebar-w)] (double-offset bug)
// ✅ Updated: fix eslint "no-useless-computed-key" for CSS var
// ✅ Keeps: guest sidebar vs authed sidebar
// ✅ Keeps: DMDrawer mounted inside frame

import React, { useMemo } from "react";
import { Outlet } from "react-router-dom";

import Navbar from "../components/navbar/Navbar";
import FriendsSidebar from "../components/friends/FriendsSidebar";
import GuestSidebar from "../components/friends/GuestSidebar";
import DMDrawer from "../components/messaging/DMDrawer/DMDrawer";
import LayoutFrame from "./LayoutFrame";

import { useUserContext } from "../components/context/userContext";

export default function ResponsiveLayout() {
  const { authLoaded, isLoggedIn } = useUserContext();

  // Step 1: Keep the CSS var if other components rely on it (drawers, transitions, etc.)
  // This value should match the sidebar width in LayoutFrame (w-[320px] lg:w-[340px]).
  // If you want it exact, set it to "320px" and adjust on lg via a different pattern.
  const SIDEBAR_WIDTH = "360px";

  const sidebarNode = useMemo(() => {
    if (!authLoaded) return null;
    return isLoggedIn ? <FriendsSidebar /> : <GuestSidebar />;
  }, [authLoaded, isLoggedIn]);

  return (
    // Step 2: Provide CSS var without computed key (eslint fix)
    <div style={{ "--sidebar-w": SIDEBAR_WIDTH }}>
      <LayoutFrame header={<Navbar />} sidebar={sidebarNode}>
        {/* Step 3: DO NOT offset route content with padding-left.
            Sidebar is in-flow in LayoutFrame; padding-left causes double spacing + broken centering. */}
        <div className="w-full">
          <Outlet />
        </div>

        {/* Step 4: DM drawer stays mounted within the frame */}
        {authLoaded && isLoggedIn ? <DMDrawer /> : null}
      </LayoutFrame>
    </div>
  );
}

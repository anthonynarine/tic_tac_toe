// # Filename: src/layout/ResponsiveLayout.jsx


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

  const sidebarNode = useMemo(() => {
    if (!authLoaded) return null;
    return isLoggedIn ? <FriendsSidebar /> : <GuestSidebar />;
  }, [authLoaded, isLoggedIn]);

  return (
    <LayoutFrame header={<Navbar />} sidebar={sidebarNode}>
      <Outlet />
      {authLoaded && isLoggedIn ? <DMDrawer /> : null}
    </LayoutFrame>
  );
}

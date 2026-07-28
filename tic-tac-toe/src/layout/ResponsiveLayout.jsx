// # Filename: tic-tac-toe/src/layout/ResponsiveLayout.jsx

import React from "react";
import { Outlet } from "react-router-dom";

import Navbar from "../components/navbar/Navbar";
import FriendsSidebar from "../components/friends/FriendsSidebar";
import DMDrawer from "../components/messaging/DMDrawer/DMDrawer";
import BottomTabBar from "../components/navbar/BottomTabBar";

import LayoutFrame from "./LayoutFrame";
import PublicAuthLayout from "./PublicAuthLayout";

import { useUserContext } from "../context/userContext";

export default function ResponsiveLayout() {
  const { authLoaded, isLoggedIn } = useUserContext();

  // Step 1: loading state (stable layout, no flicker)
  // - Keeps navbar mounted for consistent HUD
  // - Avoids sidebar/drawer mounting until auth is known (prevents WS/drawer races)
  if (!authLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-app">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto mb-4 rounded-lg bg-brand-cyan/10 border border-brand-cyan/25 animate-pulse" />
          <p className="text-[10px] tracking-[0.3em] uppercase font-semibold text-text-muted">Loading</p>
        </div>
      </div>
    );
  }

  // Step 2: Guests get the public layout ONLY
  // Prevents GuestSidebar being squeezed by LayoutFrame's mobile "w-0" aside.
  if (!isLoggedIn) {
    return <PublicAuthLayout />;
  }

  // Step 3: Authed users get the full app shell (sidebar + drawers)
  const SIDEBAR_WIDTH = "360px";

  return (
    <div style={{ "--sidebar-w": SIDEBAR_WIDTH }}>
      <LayoutFrame
        header={<Navbar />}
        sidebar={<FriendsSidebar />}
        overlay={
          <>
            <DMDrawer />
            <BottomTabBar />
          </>
        }
      >
        <div className="w-full min-w-0">
          <Outlet />
        </div>
      </LayoutFrame>
    </div>
  );
}

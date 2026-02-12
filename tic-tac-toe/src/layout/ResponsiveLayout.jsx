// # Filename: tic-tac-toe/src/layout/ResponsiveLayout.jsx

import React from "react";
import { Outlet } from "react-router-dom";

import Navbar from "../components/navbar/Navbar";
import FriendsSidebar from "../components/friends/FriendsSidebar";
import DMDrawer from "../components/messaging/DMDrawer/DMDrawer";

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
      <div className="min-h-screen bg-black">
        <Navbar />
        <main className="mx-auto w-full max-w-[1100px] px-4 py-8">
          <div className="rounded-2xl border border-cyan-500/20 bg-black/40 p-6">
            <div className="text-sm tracking-widest text-cyan-300/70">
              AUTH
            </div>
            <div className="mt-2 text-cyan-200/90">
              Initializing session…
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded bg-cyan-500/10">
              <div className="h-full w-1/3 animate-pulse bg-cyan-400/30" />
            </div>
            <div className="mt-4 text-xs text-cyan-300/50">
              If this takes more than a few seconds, refresh the page.
            </div>
          </div>
        </main>
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
      <LayoutFrame header={<Navbar />} sidebar={<FriendsSidebar />}>
        <div className="w-full min-w-0">
          <Outlet />
        </div>

        <DMDrawer />
      </LayoutFrame>
    </div>
  );
}

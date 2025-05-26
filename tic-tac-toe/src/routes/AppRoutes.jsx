// AppRoutes.jsx (Refactored for production layout)
import React from "react";
import AppShell from "../layout/AppShell";
import Navbar from "../components/navbar/Navbar";
import ResponsiveLayout from "../layout/ResponsiveLayout";

import { useUserContext } from "../components/context/userContext";
import { FriendsProvider } from "../components/context/friendsContext";
import { LobbyProvider } from "../components/context/lobbyContext";

import "../layout/layout.css";

/**
 * AppRoutes
 *
 * Root router logic for both guest and logged-in user views.
 * Uses ResponsiveLayout for managing adaptive screen logic.
 */
const AppRoutes = () => {
  const { isLoggedIn, authLoaded } = useUserContext();

  if (!authLoaded) return null;

  // Guest users (unauthenticated)
  if (!isLoggedIn) {
    return (
      <LobbyProvider>
        <AppShell>
          <div className="app-frame">
            <Navbar />
            <div className="frame-body">
              {/* Guests only see main routes */}
              <ResponsiveLayout isGuest />
            </div>
          </div>
        </AppShell>
      </LobbyProvider>
    );
  }

  // Logged-in users (authenticated)
  return (
    <LobbyProvider>
      <FriendsProvider>
        <AppShell>
          <div className="app-frame">
            <Navbar />
            <ResponsiveLayout />
          </div>
        </AppShell>
      </FriendsProvider>
    </LobbyProvider>
  );
};

export default AppRoutes;

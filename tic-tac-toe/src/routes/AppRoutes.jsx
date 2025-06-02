// AppRoutes.jsx
import React from "react";
import { useUserContext } from "../components/context/userContext";
import { LobbyProvider } from "../components/context/lobbyContext";
import { FriendsProvider } from "../components/context/friendsContext";

import AppShell from "../layout/AppShell";
import Navbar from "../components/navbar/Navbar";
import ResponsiveLayout from "../layout/ResponsiveLayout";

import "../layout/layout.css";

const AppRoutes = () => {
  const { isLoggedIn, authLoaded } = useUserContext();

  if (!authLoaded) return null;

  if (!isLoggedIn) {
    return (
      <LobbyProvider>
        <AppShell>
          <div className="app-frame">
            <Navbar />
            <div className="frame-body">
              <ResponsiveLayout isGuest />
            </div>
          </div>
        </AppShell>
      </LobbyProvider>
    );
  }

  return (
    <LobbyProvider>
      <FriendsProvider>
        <AppShell>
          <div className="app-frame">
            <Navbar />
            <ResponsiveLayout />
            {/* Trinity moved inside FriendsSidebar */}
          </div>
        </AppShell>
      </FriendsProvider>
    </LobbyProvider>
  );
};

export default AppRoutes;

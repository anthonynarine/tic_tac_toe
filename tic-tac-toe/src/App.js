import React from "react";

import AppRoutes from "./routes/AppRoutes";
import { UIProvider } from "./context/uiContext";
import { UserProvider, useUserContext } from "./context/userContext";

import { FriendsProvider } from "./context/friendsContext";
import { InviteProvider } from "./context/inviteContext";
import { NotificationProvider } from "./context/notificatonContext";
import { DirectMessageProvider } from "./context/directMessageContext";

function AuthedProviders({ children }) {
  const { authLoaded, isLoggedIn } = useUserContext();

  // # Step 1: Don’t mount sockets/providers until auth is resolved
  if (!authLoaded) return children;

  // # Step 2: Guests get no WS providers
  if (!isLoggedIn) return children;

  return (
    <InviteProvider>
      <NotificationProvider>
        <FriendsProvider>
          <DirectMessageProvider>{children}</DirectMessageProvider>
        </FriendsProvider>
      </NotificationProvider>
    </InviteProvider>
  );
}

export default function App() {
  return (
    <UserProvider>
      <UIProvider>
        <AuthedProviders>
          <AppRoutes />
        </AuthedProviders>
      </UIProvider>
    </UserProvider>
  );
}

// # Filename: src/routes/AppRoutes.jsx
// ✅ Updated Code: key Game WS route by :id + location.search (rematch-safe)

import React from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useParams,
} from "react-router-dom";

import AppShell from "../layout/AppShell";
import ResponsiveLayout from "../layout/ResponsiveLayout";
import PublicAuthLayout from "../layout/PublicAuthLayout";

import RequireAuth from "./RequireAuth";
import { useUserContext } from "../context/userContext";

import HomePage from "../components/home/HomePage";
import LoginPage from "../components/user/LoginPage";
import SignupPage from "../components/user/RegisterPage";

import Lobby from "../components/lobby/components/Lobby";
import GamePage from "../components/game/Gamepage";
import AIGamePage from "../components/game/AIGamePage";
import RecruiterDemoPage from "../components/recruiter/RecruiterDemoPage";
import TechnicalPaper from "../components/technical-paper/TechnicalPaper";


import { GameWebSocketProvider } from "../websocket/GameWebSocketProvider";

import { InviteProvider } from "../context/inviteContext";
import { NotificationProvider } from "../context/notificatonContext";
import { FriendsProvider } from "../context/friendsContext";
import { DirectMessageProvider } from "../context/directMessageContext";
import { LobbyProvider } from "../context/lobbyContext";


import { GameProvider } from "../context/gameContext";

function AuthedProviders({ children }) {
  const { authLoaded, isLoggedIn } = useUserContext();
  if (!authLoaded || !isLoggedIn) return children;

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

function ProtectedLayout() {
  return (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  );
}

/**
 * ✅ Keyed route wrapper:
 * - Remounts GameWebSocketProvider when:
 *   - :id changes (new game)
 *   - query params change (new sessionKey/lobby)
 */
function GameRoute() {
  const { id } = useParams();
  const location = useLocation();

  // Step 1: Key on id + querystring so rematch navigation forces a clean remount
  const providerKey = `${id}:${location.search}`;

  return (
    <GameWebSocketProvider key={providerKey}>
      <GamePage />
    </GameWebSocketProvider>
  );
}

export default function AppRoutes() {
  const { authLoaded } = useUserContext();
  if (!authLoaded) return null;

  return (
    <LobbyProvider>
      <AppShell>
        <AuthedProviders>
          <Routes>
            <Route element={<ResponsiveLayout />}>
              <Route path="/" element={<HomePage />} />
                {/* <Route path="/games/sudoku" element={<SudokuPage />} /> */}

              <Route element={<ProtectedLayout />}>
                {/* Lobby needs GameProvider */}
                <Route
                  path="/lobby/:id"
                  element={
                    <GameProvider>
                      <Lobby />
                    </GameProvider>
                  }
                />

                {/* ✅ AI route must exist and must mount AIGamePage */}
                <Route path="/games/ai/:id" element={<AIGamePage />} />

                {/* ✅ Multiplayer WS route (keyed) */}
                <Route path="/games/:id" element={<GameRoute />} />

                <Route path="/recruiter-demo" element={<RecruiterDemoPage />} />
                <Route path="/technical-paper" element={<TechnicalPaper />} />
              </Route>
            </Route>

            <Route element={<PublicAuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/register" element={<SignupPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthedProviders>
      </AppShell>
    </LobbyProvider>
  );
}

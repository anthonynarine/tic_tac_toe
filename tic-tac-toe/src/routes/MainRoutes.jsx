// # Filename: src/components/routes/MainRoutes.jsx
// ✅ New Code (comment-only improvements)

import React from "react";
import { Route, Routes } from "react-router-dom";

import HomePage from "../components/home/HomePage";
import LoginPage from "../components/user/LoginPage";
import RegistrationPage from "../components/user/RegisterPage";
import { GamePage } from "../components/game/Gamepage";
import LobbyPage from "../components/lobby/LobbyPage";
import ToastTestPage from "../utils/toast/ToastTestPage";
import RecruiterDemoPage from "../components/recruiter/RecruiterDemoPage";

import { GameProvider } from "../components/context/gameContext";
import { GameWebSocketProvider } from "../components/websocket/GameWebSocketProvider";

/**
 * MainRoutes
 *
 * Standalone route container for all primary application views.
 * Safe to import inside ResponsiveLayout or AppShell without triggering render loops.
 *
 * Notes:
 * - /recruiter is intentionally NOT linked in the in-app nav.
 *   It should only be reachable from the Portfolio Hub recruiter card.
 * - Game/Lobby routes are wrapped with WebSocket + GameProvider
 *   so multiplayer state and WS event handlers are scoped to those views.
 */
const MainRoutes = () => (
  <div className="main-content">
    <Routes>
      {/* Step 1: Public pages */}
      <Route path="/" element={<HomePage />} />
      <Route path="/register" element={<RegistrationPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Step 2: Recruiter-only demo entry (tab-scoped auth) */}
      <Route path="/recruiter" element={<RecruiterDemoPage />} />

      {/* Step 3: Multiplayer routes (scoped WS + game state providers) */}
      <Route
        path="/games/:id"
        element={
          <GameWebSocketProvider>
            <GameProvider>
              <GamePage />
            </GameProvider>
          </GameWebSocketProvider>
        }
      />

      <Route
        path="/lobby/:id"
        element={
          <GameWebSocketProvider>
            <GameProvider>
              <LobbyPage />
            </GameProvider>
          </GameWebSocketProvider>
        }
      />

      {/* Step 4: Utilities */}
      <Route path="/toast-test-page" element={<ToastTestPage />} />
    </Routes>
  </div>
);

export default MainRoutes;

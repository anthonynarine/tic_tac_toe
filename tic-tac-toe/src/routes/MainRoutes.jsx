// # Filename: src/components/routes/MainRoutes.jsx

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

import AIGamePage from "../components/game/AIGamePage";

const MainRoutes = () => (
  <div className="main-content">
    <Routes>
      {/* Step 1: Public pages */}
      <Route path="/" element={<HomePage />} />
      <Route path="/register" element={<RegistrationPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Step 2: Recruiter-only demo entry */}
      <Route path="/recruiter" element={<RecruiterDemoPage />} />

      {/* Step 3a: AI games (HTTP-only, NO WebSocketProvider) */}
      <Route
        path="/games/ai/:id"
        element={
          <GameProvider>
            <AIGamePage />
          </GameProvider>
        }
      />

      {/* Step 3b: Multiplayer game (WITH Game WebSocketProvider) */}
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

      {/* Step 3c: Lobby (NO Game WebSocketProvider) */}
      <Route
        path="/lobby/:id"
        element={
          <GameProvider>
            <LobbyPage />
          </GameProvider>
        }
      />

      {/* Step 4: Utilities */}
      <Route path="/toast-test-page" element={<ToastTestPage />} />
    </Routes>
  </div>
);

export default MainRoutes;

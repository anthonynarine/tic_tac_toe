// components/routes/MainRoutes.jsx

import React from "react";
import { Route, Routes } from "react-router-dom";


import HomePage from "../components/home/HomePage";
import LoginPage from "../components/user/LoginPage";
import RegistrationPage from "../components/user/RegisterPage";
import { GamePage } from "../components/game/Gamepage";
import LobbyPage from "../components/lobby/LobbyPage";
import ToastTestPage from "../utils/toast/ToastTestPage";

import { GameProvider } from "../components/context/gameContext";
import { GameWebSocketProvider } from "../components/websocket/GameWebSocketProvider";

/**
 * MainRoutes
 *
 * Standalone route container for all primary application views.
 * Safe to import inside ResponsiveLayout or AppShell without triggering render loops.
 */
const MainRoutes = () => (
    <div className="main-content">
        <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegistrationPage />} />
        <Route path="/login" element={<LoginPage />} />
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
        <Route path="/toast-test-page" element={<ToastTestPage />} />
        </Routes>
    </div>
);

export default MainRoutes;

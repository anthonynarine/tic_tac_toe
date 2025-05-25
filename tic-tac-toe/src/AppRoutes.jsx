// AppRoutes.jsx
import React from "react";
import { Route, Routes } from "react-router-dom";

import HomePage from "./components/home/HomePage";
import LoginPage from "./components/user/LoginPage";
import RegistrationPage from "./components/user/RegisterPage";
import { GamePage } from "./components/game/Gamepage";
import LobbyPage from "./components/lobby/LobbyPage";
import TechnicalPaper from "./components/technical-paper/TechnicalPaper";
import ToastTestPage from "./utils/toast/ToastTestPage";

import AppShell from "./layout/AppShell";
import Navbar from "./components/navbar/Navbar";
import FriendsSidebar from "./components/friends/FriendsSidebar";

import { useUserContext } from "./components/context/userContext";
import { FriendsProvider } from "./components/context/friendsContext";
import { LobbyProvider } from "./components/context/lobbyContext";
import { GameProvider } from "./components/context/gameContext";
import { GameWebSocketProvider } from "./components/websocket/GameWebSocketProvider";

import { useUI } from "./components/context/uiContext";         // ✅ sidebar toggle state
import useIsDesktop from "./components/hooks/useIsDesktop";

import "./layout/layout.css";

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
                <div className="game-wrapper">
                    <GamePage />
                </div>
                </GameProvider>
            </GameWebSocketProvider>
            }
        />
        <Route
            path="/lobby/:id"
            element={
            <GameProvider>
                <LobbyPage />
            </GameProvider>
            }
        />
        <Route path="/toast-test-page" element={<ToastTestPage />} />
        <Route path="/technical-paper" element={<TechnicalPaper />} />
        </Routes>
    </div>
);

const AppRoutes = () => {
    const { isLoggedIn, authLoaded } = useUserContext();
    const { isSidebarOpen } = useUI();       // ✅ controls sidebar visibility
    const isDesktop = useIsDesktop();        // ✅ detect if screen is desktop

    if (!authLoaded) return null;

    // Guest view
    if (!isLoggedIn) {
        return (
        <LobbyProvider>
            <AppShell>
            <div className="app-frame">
                <Navbar />
                <div className="frame-body">
                <MainRoutes />
                </div>
            </div>
            </AppShell>
        </LobbyProvider>
        );
    }

    // Logged-in view
    return (
        <LobbyProvider>
        <FriendsProvider>
            <AppShell>
            <div className="app-frame">
                <Navbar />
                <div className="frame-body">
                {/* ✅ Show sidebar only on desktop or if mobile toggle is open */}
                {isDesktop ? <FriendsSidebar /> : isSidebarOpen && <FriendsSidebar />}
                <MainRoutes />
                </div>
            </div>
            </AppShell>
        </FriendsProvider>
        </LobbyProvider>
    );
};

export default AppRoutes;

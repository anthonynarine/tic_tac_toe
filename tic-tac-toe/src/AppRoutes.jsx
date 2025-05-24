// AppRoutes.jsx
// ------------------
// This file contains the main route logic for the application.
// It determines what layout and providers to apply based on login state.
// - If the user is not logged in: Navbar + Routes only (e.g. Home, Login, Register)
// - If the user is logged in: Full layout including FriendsSidebar and FriendsProvider
// This structure separates routing concerns from the main App.js entry point.

import React from "react";
import { Route, Routes } from "react-router-dom";

// Pages for routing
import HomePage from "./components/home/HomePage";
import LoginPage from "./components/user/LoginPage";
import RegistrationPage from "./components/user/RegisterPage";
import { GamePage } from "./components/game/Gamepage";
import LobbyPage from "./components/lobby/LobbyPage";
import TechnicalPaper from "./components/technical-paper/TechnicalPaper";
import ToastTestPage from "./utils/toast/ToastTestPage";

// Layout structure
import AppShell from "./layout/AppShell";
import LayoutFrame from "./layout/LayoutFrame";
import Navbar from "./components/navbar/Navbar";
import FriendsSidebar from "./components/friends/FriendsSidebar";

// Contexts scoped to this layer
import { useUserContext } from "./components/context/userContext";
import { FriendsProvider } from "./components/context/friendsContext";
import { LobbyProvider } from "./components/context/lobbyContext";
import { GameProvider } from "./components/context/gameContext";
import { GameWebSocketProvider } from "./components/websocket/GameWebSocketProvider";

// All routes grouped here
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

// AppRoutes chooses the layout and providers based on auth state
const AppRoutes = () => {
    const { isLoggedIn, authLoaded } = useUserContext();

    // Avoid rendering UI until auth status is confirmed
    if (!authLoaded) return null;

    // Guest view (unauthenticated user)
    if (!isLoggedIn) {
        return (
        <LobbyProvider>
            <AppShell>
            <Navbar />
            <LayoutFrame>
                <MainRoutes />
            </LayoutFrame>
            </AppShell>
        </LobbyProvider>
        );
    }

    // Authenticated user view with sidebar and friends features
    return (
        <LobbyProvider>
        <FriendsProvider>
            <AppShell>
            <Navbar />
            <LayoutFrame>
                <FriendsSidebar />
                <MainRoutes />
            </LayoutFrame>
            </AppShell>
        </FriendsProvider>
        </LobbyProvider>
    );
};

export default AppRoutes;

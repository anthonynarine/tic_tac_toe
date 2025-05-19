import { Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import React from "react";

import Navbar from "./components/navbar/Navbar";
import HomePage from "./components/home/HomePage";
import LoginPage from "./components/user/LoginPage";
import RegistrationPage from "./components/user/RegisterPage";
import { GamePage } from "./components/game/Gamepage";
import ToastTestPage from "./utils/toast/ToastTestPage";
import LobbyPage from "./components/lobby/LobbyPage";
import TechnicalPaper from "./components/technical-paper/TechnicalPaper";

import { UserProvider, useUserContext } from "./components/context/userContext";
import { FriendsProvider } from "./components/context/friendsContext";
import { GameProvider } from "./components/context/gameContext";
import { LobbyProvider } from "./components/context/lobbyContext";
import { GameWebSocketProvider } from "./components/websocket/GameWebSocketProvider";
import { DirectMessageProvider } from "./components/context/directMessageContext";

/**
 * Renders app once authentication state has loaded.
 * Ensures FriendsProvider is only used after login to avoid 401 loop.
 */
const MainApp = () => {
    const { isLoggedIn, authLoaded } = useUserContext();

    if (!authLoaded) return null; // Optional: Replace with <LoadingSpinner />

    return (
        <LobbyProvider>
        {isLoggedIn ? (
            <FriendsProvider>
                <Navbar />
                <MainRoutes />
            </FriendsProvider>
        ) : (
            <>
                <Navbar />
                <MainRoutes />
            </>
        )}
        </LobbyProvider>
    );
    };

    /**
     * Defines app routes. Game and Lobby routes use WebSocket/Game context.
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

    /**
     * Wraps app in top-level UserProvider and global Toast container.
     */
    function App() {
    return (
        <>
        <ToastContainer />
        <UserProvider> {/* Global user info context */}
            <DirectMessageProvider> {/* Global DM context */}
                <MainApp />
            </DirectMessageProvider>
        </UserProvider>
        </>
    );
}

export default App;

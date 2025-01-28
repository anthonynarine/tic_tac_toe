import { Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import React from "react";

import Navbar from "./components/navbar/Navbar";
import HomePage from "./components/home/HomePage";
import LoginPage from "./components/user/LoginPage";
import RegistrationPage from "./components/user/RegisterPage";
import { GamePage } from "./components/game/Gamepage";
import ToastTestPage from "./utils/toast/ToastTestPage";
import Lobby from "./components/lobby/Lobby";
import LobbyPage from "./components/lobby/Lobbypage";

import { UserProvider } from "./components/context/userContext";
import { GameProvider } from "./components/context/gameContext";
import { LobbyProvider } from "./components/context/lobbyContext";
import { GameWebSocketProvider } from "./components/websocket/GameWebSocketProvider";

function App() {
    return (
        <>
            <ToastContainer />
            <UserProvider>
                <GameWebSocketProvider>
                    <LobbyProvider>
                        <Navbar />
                        <div className="main-content">
                            <Routes>
                                <Route path="/" element={<HomePage />} />
                                <Route path="/register" element={<RegistrationPage />} />
                                <Route path="/login" element={<LoginPage />} />
                                {/* Game route wrapped with GameProvider */}
                                <Route
                                    path="/games/:id"
                                    element={
                                        <GameProvider>
                                            <GamePage />
                                        </GameProvider>
                                    }
                                />
                                {/* Wrap Lobby route with GameProvider */}
                                <Route
                                    path="/lobby/:id"
                                    element={
                                        <GameProvider>
                                            <LobbyPage />
                                        </GameProvider>
                                    }
                                />
                                <Route path="/toast-test-page" element={<ToastTestPage />} />
                            </Routes>
                        </div>
                    </LobbyProvider>
                </GameWebSocketProvider>
            </UserProvider>
        </>
    );
}

export default App;

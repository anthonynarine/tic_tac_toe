import { Route, Routes, useParams } from "react-router-dom";
import { ToastContainer } from "react-toastify";D

import Navbar from "./components/navbar/Navbar";
import HomePage from "./components/home/HomePage";
import LoginPage from "./components/user/LoginPage";
import RegistrationPage from "./components/user/RegisterPage";
import { GamePage } from "./components/game/Gamepage";
import ToastTestPage from "./utils/toast/ToastTestPage";
import LobbyPage from "./components/lobby/LobbyPage";

import { UserProvider } from "./components/context/userContext";
import { LobbyProvider } from "./components/context/lobbyContext";
import { GameWebSocketProvider } from "./components/websocket/GameWebSocketProvider";
import { ChatWebsocketProvider } from "./components/websocket/ChatWebsocketProvider";

// ChatProviderWrapper ensures lobbyName is passed correctly
const ChatProviderWrapper = ({ children }) => {
    const { id: lobbyName } = useParams();
    return <ChatWebsocketProvider lobbyName={lobbyName}>{children}</ChatWebsocketProvider>;
};

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
                                <Route path="/games/:id" element={<GamePage />} />
                                <Route
                                    path="/lobbypage/:id"
                                    element={
                                        <ChatProviderWrapper>
                                            <LobbyPage />
                                        </ChatProviderWrapper>
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

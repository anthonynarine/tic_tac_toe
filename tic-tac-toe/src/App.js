import { Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import Navbar from "./components/navbar/Navbar";
import HomePage from "./components/home/HomePage";
import LoginPage from "./components/user/LoginPage";
import RegistrationPage from "./components/user/RegisterPage";
// import { Game } from "./components/game/Game";
import { GamePage } from "./components/game/Gamepage";
import ToastTestPage from "./utils/toast/ToastTestPage";
import LobbyPage from "./components/lobby/LobbyPage";
import Lobby from "./components/lobby/Lobby";

import { UserProvider } from "./components/context/userContext";
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
                <Route path="/games/:id" element={<GamePage />} />
                {/* <Route path="/lobby/:id" element={<Lobby />} /> */}
                <Route path="lobbypage/:id" element={<LobbyPage />} />
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

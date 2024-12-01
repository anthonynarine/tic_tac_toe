
import { Route, Routes } from "react-router-dom"
import "./components/game/Game"
import { Game } from "./components/game/Game";
import LoginPage from "./components/user/LoginPage"
import RegistrationPage from "./components/user/RegisterPage";
import Navbar from "./components/navbar/Navbar";
import HomePage from "./components/home/HomePage";
import ToastTestPage from "./utils/toast/ToastTestPage";
import { UserProvider } from "./components/context/userContext";
import { GameProvider } from "./components/context/gameContext";



function App() {
  return (
    <>
    <UserProvider>
      <GameProvider>
        <Navbar />
        <div className="main-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/register" element={<RegistrationPage/>} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/games/:id" element={<Game />} />
              <Route path="/toast-test-page" element={ <ToastTestPage/> } />
            </Routes>
          </div>
        </GameProvider>
    </UserProvider>
    </>
  );
}

export default App;

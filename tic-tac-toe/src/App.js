
import { Route, Routes } from "react-router-dom"
import "./components/game/Game"
import { Game } from "./components/game/Game";
import LoginPage from "./components/user/LoginPage"
import RegistrationPage from "./components/user/RegisterPage";
import Navbar from "./components/navbar/Navbar";
import HomePage from "./components/home/HomePage";



function App() {
  return (
    <>
    <Navbar />
    <div className="main-content">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegistrationPage/>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/game" element={<Game />} />

      </Routes>
      </div>
    </>
  );
}

export default App;

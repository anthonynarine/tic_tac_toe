import { GameV1 } from "./components/game/GameV1"
import { Route, Routes } from "react-router-dom"
import "./components/game/Game"
import Game from "./components/game/Game";
import LoginPage from "./components/user/LoginPage"
import RegistrationPage from "./components/user/RegisterPage";
import Navbar from "./components/navbar/Navbar";


function App() {
  return (
    <>
    <Navbar />
    <div className="main-content">
      <Routes>
        <Route path="/" element={<Game />} />
        <Route path="/register" element={<RegistrationPage/>} />
        <Route path="/login" element={<LoginPage />} />
        {/* <GameV1 /> */}
      </Routes>
      </div>
    </>
  );
}

export default App;

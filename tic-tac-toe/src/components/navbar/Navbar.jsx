import React, { useState } from "react";
import { FaBars, FaTimes, FaUser, FaSignInAlt, FaSignOutAlt } from "react-icons/fa";
import { GrGamepad } from "react-icons/gr";
import "./Navbar.css";
import logo from "../assets/logo1.png";
import { useAuth } from "../hooks/useAuth";
import { useUserContext } from "../context/userContext";
import useGameServices from "../hooks/useGameServices";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isAIGame, setIsAIGame] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);

  const { createNewGame } = useGameServices();
  const { isLoggedIn, user } = useUserContext();
  const { logout } = useAuth(); 

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const startMultiplayerGame = () => {
    createNewGame(user.first_name, false); // Use user data from context
    setIsAIGame(true);
  };

  const startAIGame = () => {
    createNewGame(user.first_name, true); // Use user data from context
    setIsGameStarted(true);
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <img src={logo} alt="Tic Tac Toe Logo" className="app-logo" />
      </div>

      <div className="game-icon-container" onClick={toggleDropdown}>
        <GrGamepad className="game-icon" />
        {dropdownOpen && (
          <div className="dropdown-menu">
            <button onClick={startMultiplayerGame}>Play Multiplayer</button>
            <button onClick={startAIGame}>Play vs AI</button>
          </div>
        )}
      </div>

      <div className={`navbar-links ${isOpen ? "active" : ""}`}>
        <ul>
          {!isLoggedIn && (
            <li>
              <a href="/login" title="Login">
                <FaSignInAlt className="nav-icon" />
              </a>
            </li>
          )}
          {isLoggedIn && (
            <>
              <li>
                <button onClick={logout} title="Logout" className="nav-button">
                  <FaSignOutAlt className="nav-icon" />
                </button>
              </li>
              <li>
                <a href="/profile" title="Profile">
                  <FaUser className="nav-icon" />
                </a>
              </li>
            </>
          )}
        </ul>
      </div>

      <div className="navbar-toggle" onClick={toggleMenu}>
        {isOpen ? <FaTimes /> : <FaBars />}
      </div>
    </nav>
  );
};

export default Navbar;

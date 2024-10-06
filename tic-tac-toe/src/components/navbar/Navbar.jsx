import React, { useState } from "react";
import { FaBars, FaTimes, FaUser, FaSignInAlt, FaSignOutAlt } from "react-icons/fa";
import { GrGamepad } from "react-icons/gr";
import "./Navbar.css";
import logo from "../assets/logo1.png";
import logored from "../assets/logo-red.png";
import { useAuth } from "../hooks/useAuth";
import { useUserContext } from "../context/userContext";
import useGameServices from "../hooks/useGameServices";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false); // For mobile menu toggle
  const [dropdownOpen, setDropdownOpen] = useState(false); // For game dropdown

  const { createNewGame } = useGameServices();
  const { isLoggedIn, user } = useUserContext();
  const { logout } = useAuth();

  // Toggle Mobile Menu
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  // Toggle Dropdown Menu
  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const startMultiplayerGame = () => {
    createNewGame(user?.first_name || "Player", false);
    setDropdownOpen(false);
  };

  const startAIGame = () => {
    createNewGame(user?.first_name || "Player", true);
    setDropdownOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="navbar-brand">
          <img src={logored} alt="Tic Tac Toe Logo" className="app-logo" />
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
            {!isLoggedIn ? (
              <li>
                <a href="/login" title="Login">
                  <FaSignInAlt className="nav-icon" />
                </a>
              </li>
            ) : (
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
      </div>
    </nav>
  );
};

export default Navbar;

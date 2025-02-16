import React, { useState } from "react";
import { FaBars, FaTimes, } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "./Navbar.css";
import { PiGameControllerThin } from "react-icons/pi";
import { CiLogin, CiLogout } from "react-icons/ci";

import { useAuth } from "../hooks/useAuth";
import { useUserContext } from "../context/userContext";
import useGameCreation from "../hooks/useGameCreation";

import { LiaUserNinjaSolid } from "react-icons/lia";
import { CiHome } from "react-icons/ci";


const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false); // For mobile menu toggle
  const [dropdownOpen, setDropdownOpen] = useState(false); // For game dropdown

  const { createNewGame } = useGameCreation();
  const { isLoggedIn, user } = useUserContext();
  const { logout } = useAuth();
  const navigate = useNavigate();
  // Toggle Mobile Menu
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  // Toggle Dropdown Menu
  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const startMultiplayerGame = async () => {
    try {
      const newGame = await createNewGame(user?.first_name || "Player", false);
      if (newGame){
        navigate(`/lobby/${newGame.id}`);
      }
    } catch (error) {
      console.log("error", error)
    } finally {
      setDropdownOpen(false)
    }
  };

  const startAIGame = async () => {
    try {
      const newGame = await createNewGame(user?.first_name || "Player", true);
      if (newGame) {
        navigate(`/games/${newGame.id}`); 
      } 
    } catch (error) {
      console.log("error", error);
    } finally {
      setDropdownOpen(false);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="navbar-brand">
          <CiHome className="game-icon" />
          {/* <img src={logored} alt="Tic Tac Toe Logo" className="app-logo" /> */}
        </div>

        <div className="game-icon-container" onClick={toggleDropdown}>
          <PiGameControllerThin className="game-icon" />
          {dropdownOpen && (
            <div className="dropdown-menu">
              <button onClick={startMultiplayerGame}>Multiplayer</button>
              <button onClick={startAIGame}>Play vs AI</button>
            </div>
          )}
        </div>

        <div className={`navbar-links ${isOpen ? "active" : ""}`}>
          <ul>
            {!isLoggedIn ? (
              <li>
                <a href="/login" title="Login">
                  <CiLogin className="nav-icon" />
                </a>
              </li>
            ) : (
              <>
                <li>
                  <button onClick={logout} title="Logout" className="nav-button">
                    <CiLogout className="nav-icon" />
                  </button>
                </li>
                <li>
                  <a href="/profile" title="Profile">
                    <LiaUserNinjaSolid className="nav-icon" />
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

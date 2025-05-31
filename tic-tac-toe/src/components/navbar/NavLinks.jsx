import React from "react";
import { CiLogin, CiLogout } from "react-icons/ci";

const NavLinks = ({ isLoggedIn, user, logout, navigate, setSidebarOpen, isOpen }) => (
    <div className={`navbar-links ${isOpen ? "active" : ""}`}>
        <ul>
        {!isLoggedIn ? (
            <li>
            <button onClick={() => navigate("/login")} title="Login" className="nav-button">
                <CiLogin className="nav-icon" />
            </button>
            </li>
        ) : (
            <>
            <li>
                <button onClick={logout} title="Logout" className="nav-button">
                <CiLogout className="nav-icon" />
                </button>
            </li>
            <li>
                <button onClick={() => navigate("/profile")} title="Profile" className="nav-button">
                <span className="nav-label glow-pulse">{user?.first_name}</span>
                </button>
            </li>
            <li>
                <button onClick={() => navigate("/technical-paper")} title="About" className="nav-button">
                <span className="nav-label glow-pulse">About</span>
                </button>
            </li>
            </>
        )}
        </ul>
    </div>
);

export default NavLinks;

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
            <div className="mobile-social-only">
                <li>
                <button onClick={() => setSidebarOpen(true)} title="Friends" className="nav-button">
                    <span className="nav-label glow-pulse">Social</span>
                </button>
                </li>
            </div>
            </>
        )}
        </ul>
    </div>
);

export default NavLinks;

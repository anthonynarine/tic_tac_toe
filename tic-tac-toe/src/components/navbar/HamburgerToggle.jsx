import React from "react";
import { FaBars, FaTimes } from "react-icons/fa";

const HamburgerToggle = ({ isOpen, toggleMenu }) => (
    <div className="navbar-toggle" onClick={toggleMenu}>
        {isOpen ? <FaTimes /> : <FaBars />}
    </div>
);

export default HamburgerToggle;

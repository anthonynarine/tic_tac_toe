// src/components/technical/DrawerSection.jsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DrawerSection = ({ id, title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div id={id} className="drawer-section">
        <button
            onClick={() => setIsOpen(!isOpen)}
            className={`drawer-header ${isOpen ? "open" : ""}`}
        >
            <span>{title}</span>
            <span className="drawer-icon">{isOpen ? "▾" : "▸"}</span>
        </button>

        <AnimatePresence initial={false}>
            {isOpen && (
            <motion.div
                className="drawer-body"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
            >
                {children}
            </motion.div>
            )}
        </AnimatePresence>
        </div>
    );
};

export default DrawerSection;

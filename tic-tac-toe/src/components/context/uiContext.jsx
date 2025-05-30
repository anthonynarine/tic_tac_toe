/**
 * UIContext
 *
 * Provides global UI state for layout elements like the sidebar and DM drawer.
 * This context allows components throughout the app to open/close:
 * - The mobile sidebar (isSidebarOpen)
 * - The DM drawer (isDMOpen)
 *
 * Usage:
 *   const { isSidebarOpen, setSidebarOpen, isDMOpen, setDMOpen } = useUI();
 *
 * Wrap your app with <UIProvider> in the root layout.
 */

import { createContext, useContext, useState } from "react";

const UIContext = createContext();

/**
 * Custom hook for accessing the UI context values.
 * @returns {object} - UI state and control setters
 */
export const useUI = () => useContext(UIContext);

/**
 * UIProvider
 *
 * Wraps the app and provides UI state for sidebar and DM drawer.
 */
export const UIProvider = ({ children }) => {
  // Controls whether the mobile sidebar is visible
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    // Controls whether the DM drawer is open (on desktop or mobile)
    const [isDMOpen, setDMOpen] = useState(false);

    return (
        <UIContext.Provider
        value={{
            isSidebarOpen,
            setSidebarOpen,
            isDMOpen,
            setDMOpen,
        }}
        >
        {children}
        </UIContext.Provider>
    );
};

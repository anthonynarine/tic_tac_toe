// # Filename: src/components/context/userContext.jsx


import { useState, useEffect, createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";

import { getToken } from "../auth/tokenStore"; 
import { isRecruiterMode } from "../auth/authMode"; 

/**
 * Context to hold the current user data and login status globally.
 * @typedef {Object} UserContextValue
 * @property {Object|null} user - The currently logged-in user's data.
 * @property {Function} setUser - Function to update user data.
 * @property {boolean} isLoggedIn - Boolean indicating login status.
 * @property {Function} setIsLoggedIn - Function to update login status.
 * @property {boolean} authLoaded - Boolean indicating whether auth check has completed.
 */

/**
 * Create the UserContext with undefined initial value.
 * Must be wrapped with a UserProvider to access.
 */
export const UserContext = createContext(undefined);

/**
 * Custom hook to access the UserContext safely.
 *
 * @returns {UserContextValue} The user context value (user, setUser, isLoggedIn, setIsLoggedIn, authLoaded)
 * @throws {Error} If used outside of a UserProvider.
 */
export function useUserContext() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error("useUserContext must be used within a UserProvider");
    }
    return context;
}

/**
 * Provides user-related state and functions to its child components.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components that will have access to the user context.
 * @returns {JSX.Element} UserProvider component wrapping the children with user state.
 */
export const UserProvider = ({ children }) => {
    // Step 1: Initialize user state
    const [user, setUser] = useState(null);

    // Step 2: Initialize login state
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // Step 3: Initialize auth loading state
    const [authLoaded, setAuthLoaded] = useState(false);

    const navigate = useNavigate();

    // Step 0: Storage must be tab-scoped in Recruiter Mode
    const getActiveStorage = () => (isRecruiterMode() ? sessionStorage : localStorage); 

    // Step 4: On mount, validate access token and restore session
    useEffect(() => {
        // Step 4.1: Token source is controlled by tokenStore (cookie/local/session)
        const token = getToken("access_token"); 

        // Step 4.2: Define which routes should NOT require auth
        // NOTE: /recruiter must be public so recruiters can open two tabs freely
        const publicRoutes = ["/login", "/register", "/recruiter"]; 
        const currentPath = window.location.pathname;

        const storage = getActiveStorage(); 

        // Step 4.3: If there's no token and user is visiting a protected page
        if (!token) {
            if (!publicRoutes.includes(currentPath)) {
                // Step 4.3.1: Clear any existing auth state (for THIS storage context)
                setUser(null);
                setIsLoggedIn(false);

                storage.removeItem("user"); 
                storage.setItem("isLoggedIn", "false");

                // Step 4.3.2: Redirect to login page
                navigate("/login");
            }

            // Step 4.3.3: Auth check finished (even if public route)
            setAuthLoaded(true);
            return;
        }

        // Step 4.4: Token exists — restore user session from active storage
        const storedUser = storage.getItem("user"); 
        if (storedUser) {
            setUser(JSON.parse(storedUser));
            setIsLoggedIn(true);
        }

        // Step 4.5: Mark auth check as completed (used to guard initial render)
        setAuthLoaded(true);
    }, [navigate]);

    // Step 5: Sync user/auth state changes with active storage
    useEffect(() => {
        const storage = getActiveStorage(); 

        if (user && isLoggedIn) {
            storage.setItem("user", JSON.stringify(user)); 
            storage.setItem("isLoggedIn", "true"); 
        } else {
            storage.removeItem("user"); 
            storage.setItem("isLoggedIn", "false"); 
        }
    }, [user, isLoggedIn]);

    // Step 6: Provide context to all children
    return (
        <UserContext.Provider
            value={{
                user,
                setUser,
                isLoggedIn,
                setIsLoggedIn,
                authLoaded,
            }}
        >
            {children}
        </UserContext.Provider>
    );
};

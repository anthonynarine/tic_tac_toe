import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useAuthAxios from "./useAuthAxios";
import { useUserContext } from "../context/userContext";
import { useLobbyContext } from "../context/lobbyContext";

export const resetContext = ({ removeToken, setUser, setIsLoggedIn, lobbyDispatch }) => {
    // STEP 1: Remove authentication tokens
    removeToken("access_token");
    removeToken("refresh_token");

    // STEP 2: Reset user context data
    setUser(null);
    setIsLoggedIn(false);

    // STEP 3: Reset lobby context
    lobbyDispatch({ type: "RESET_LOBBY" });

    console.log("Application context reset successfully.");
};

export const useAuth = () => {
    const { authAxios, setToken, removeToken } = useAuthAxios();
    const { setUser, setIsLoggedIn } = useUserContext();
    const { dispatch: lobbyDispatch } = useLobbyContext();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // Login function
    const login = useCallback(async ({ email, password }) => {
        setIsLoading(true);
        setError("");

        try {
            // STEP 1: Request tokens
            const { data: loginData } = await authAxios.post("/token/", { email, password });
            const { access: accessToken, refresh: refreshToken } = loginData;

            // STEP 2: Store tokens
            setToken("access_token", accessToken);
            setToken("refresh_token", refreshToken);
            console.log("Tokens successfully set.");

            // STEP 3: Fetch user profile
            const { data: userData } = await authAxios.get("/users/profile/", {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            console.log("User profile fetched:", userData);

            // STEP 4: Update user context
            setUser(userData);
            setIsLoggedIn(true);

            // Navigate to homepage
            navigate("/");
        } catch (error) {
            console.error("Login failed:", error);

            // Handle errors
            setError(
                error.response?.status === 401
                    ? "Invalid email or password."
                    : "An error occurred. Please try again later."
            );
        } finally {
            setIsLoading(false);
        }
    }, [authAxios, setToken, setUser, setIsLoggedIn, navigate]);

    // Logout function
    const logout = useCallback(() => {
        setError(""); // Clear error state
        resetContext({
            removeToken,
            setUser,
            setIsLoggedIn,
            lobbyDispatch,
        });
        navigate("/login");
    }, [removeToken, setUser, setIsLoggedIn, lobbyDispatch, navigate]);

    // Registration function
    const register = useCallback(async ({ email, first_name, last_name, password }) => {
        setIsLoading(true);
        setError("");

        try {
            // STEP 1: Send registration request
            const { status } = await authAxios.post("/users/", {
                email,
                first_name,
                last_name,
                password,
            });

            if (status === 201) {
                // STEP 2: Auto-login on success
                await login({ email, password });
            }
        } catch (error) {
            console.error("Registration failed:", error);

            // Handle registration errors
            setError(
                error.response?.data?.message ||
                    (error.response?.status === 400
                        ? "Validation error. Please ensure all fields are correctly filled."
                        : "An error occurred. Please try again later.")
            );
        } finally {
            setIsLoading(false);
        }
    }, [authAxios, login]);

    return {
        isLoading,
        error,
        login,
        register,
        logout,
    };
};

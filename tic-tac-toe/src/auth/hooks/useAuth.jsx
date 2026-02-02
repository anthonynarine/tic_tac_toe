// # Filename: src/components/auth/useAuth.jsx

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useAuthAxios from "../hooks/useAuthAxios";
import { useUserContext } from "../../context/userContext"
import { useLobbyContext } from "../../context/lobbyContext";

export const resetContext = ({
  removeToken,
  setUser,
  setIsLoggedIn,
  lobbyDispatch,
}) => {
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


  // STEP 0: Shared helper that completes login from known tokens.
  // This is perfect for Recruiter Demo Mode, and also safe for any future "token-based" login flows.
  const loginWithTokens = useCallback(
    async ({ access, refresh }) => {
      // STEP 1: Store tokens (respects cookie/local/session mode via tokenStore under useAuthAxios)
      setToken("access_token", access);
      setToken("refresh_token", refresh);
      console.log("Tokens successfully set (loginWithTokens).");

      // STEP 2: Fetch user profile (use access explicitly to avoid any interceptor timing issues)
      const { data: userData } = await authAxios.get("/users/profile/", {
        headers: { Authorization: `Bearer ${access}` },
      });
      console.log("User profile fetched (loginWithTokens):", userData);

      // STEP 3: Update user context
      setUser(userData);
      setIsLoggedIn(true);

      return userData;
    },
    [authAxios, setIsLoggedIn, setToken, setUser]
  );

  // Login function (normal pipeline)
  const login = useCallback(
    async ({ email, password }) => {
      setIsLoading(true);
      setError("");

      try {
        // STEP 1: Request tokens
        const { data: loginData } = await authAxios.post("/token/", {
          email,
          password,
        });

        const { access: accessToken, refresh: refreshToken } = loginData;

        // STEP 2: Complete login via shared helper (keeps demo + normal login consistent)
        await loginWithTokens({ access: accessToken, refresh: refreshToken });

        // STEP 3: Navigate to homepage
        navigate("/");
      } catch (error) {
        console.error("Login failed:", error);

        setError(
          error.response?.status === 401
            ? "Invalid email or password."
            : "An error occurred. Please try again later."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [authAxios, loginWithTokens, navigate]
  );

  // Logout function
  const logout = useCallback(() => {
    setError("");
    resetContext({
      removeToken,
      setUser,
      setIsLoggedIn,
      lobbyDispatch,
    });
    navigate("/login");
  }, [removeToken, setUser, setIsLoggedIn, lobbyDispatch, navigate]);

  // Registration function
  const register = useCallback(
    async ({ email, first_name, last_name, password }) => {
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

        setError(
          error.response?.data?.message ||
            (error.response?.status === 400
              ? "Validation error. Please ensure all fields are correctly filled."
              : "An error occurred. Please try again later.")
        );
      } finally {
        setIsLoading(false);
      }
    },
    [authAxios, login]
  );

  return {
    isLoading,
    error,
    login,
    register,
    logout,
    // STEP 3: Expose helper so RecruiterDemoPage can “finish login” after demo endpoints return tokens.
    loginWithTokens,
  };
};

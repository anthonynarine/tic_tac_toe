import Cookies from "js-cookie";
import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuthAxios from "./useAuthAxios";

export const useAuth = () => {
    const { authAxios } = useAuthAxios();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(!!Cookies.get("access_token")); //Check if token exist in cookies
    const [user, setUser] = useState(null);
    const [error, setError] = useState("");

    const login = useCallback(async ({ email, password}) => {
        setIsLoading(true);
        setError("");

        try {
            //STEP 1:  Make the request to the login endpoint to obtain tokens
            const loginResponse = await authAxios.post("/token/", { email, password});

            //STEP 2: Fetch the user data using the access token stored by axios
            const userResponse = await authAxios.get("/users/profile/");
            
            // Update the user state
            setUser(userResponse.data);
            setIsLoggedIn(true);

            navigate("/");          
        } catch (error) {
            console.error("Login failed:", error);

            // Handle invalid user credentials (this error is returned by simple jwt)
            if (error.response?.status === 401) {
                setError("Invalid email or password.");
            } else {
                setError("An error occured. Please try again later");
            }
        } finally {
            setIsLoading(false);
        }
    },[authAxios, navigate]);


    // Registration Function
    const register = useCallback(async ({ email, first_name, last_name, password }) => {
        setIsLoading(true);
        setError("")

        try {
            // STEP 1: Send registration request to the backend
            const registerResponse = await authAxios.post("/users/", {
                email,
                first_name,
                last_name,
                password,
            });

            if (registerResponse.status === 201) {
                // Automitacally log the user in afer successful registration
                await login({ email, password });
            }
        } catch (error) {
            console.error("Registration failed:", error);

            if (error.response?.status === 400) {
                setError("Validation error. Please ensure all fields are correctly filled.");
            } else if (error.response?.status === 500) {
                setError("Internal server error. Please try again later.");
            } else if (error.response?.data) {
                setError(error.response.data.message || "Registration failed. Please try again.");
            } else {
                setError("An unexpected error occurred.");
            }
        } finally {
            setIsLoading(false)
        }
    }, [authAxios, login]);

    return {
        isLoading,
        isLoggedIn,
        user,
        error,
        login,
        register,
    };
};


import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import Cookies from "js-cookie";
import axios from "axios";

const useAuthAxios = () => {
    const navigate = useNavigate();
    const isProduction = process.env.NODE_ENV === "production";

    // Log the current environment to make sure it is correct
    console.log("Current environment (isProduction):", isProduction);

    // Create the Axios instance
    const authAxios = axios.create({
        baseURL: isProduction ? process.env.REACT_APP_PROD_URL : process.env.REACT_APP_DEV_URL,
        withCredentials: true // Always true, for both environments
    });

    /**
     * Set token in cookies (production) or localStorage (development)
     */
    const setToken = (name, value, options = {}) => {
        if (isProduction) {
            console.log(`Setting token ${name} in Cookies:`, value);
            Cookies.set(name, value, {
                secure: true,
                sameSite: "None",
                expires: name === "refresh_token" ? 7 : undefined, // 7 days for refresh token
                ...options
            });
        } else {
            console.log(`Setting token ${name} in localStorage:`, value);
            localStorage.setItem(name, value);
        }
    };

    /**
     * Get token from cookies (production) or localStorage (development)
     */
    const getToken = (name) => {
        const token = isProduction ? Cookies.get(name) : localStorage.getItem(name);
        return token;
    };

    /**
     * Remove token from cookies (production) or localStorage (development)
     */
    const removeToken = (name) => {
        console.log(`Removing token ${name}`);
        if (isProduction) {
            Cookies.remove(name);
        } else {
            localStorage.removeItem(name);
        }
    };

    /**
     * Handle authentication errors by clearing tokens and redirecting to the login page.
     */
    const handleAuthError = () => {
        console.log("Handling auth error, clearing tokens.");
        // Remove tokens from cookies or local storage
        removeToken("access_token");
        removeToken("refresh_token");
        Cookies.remove("csrftoken");  // Always remove CSRF token from cookies
        Cookies.remove("sessionid");  // Optional: Remove session ID if stored

        navigate("/login"); // Redirect to the login page
    };

    /**
     * Request interceptor to attach access token and CSRF token to request headers.
     */
    const requestInterceptor = (config) => {
        console.log("Intercepting request:", config.url);

        const accessToken = getToken("access_token"); // Retrieve the access token
        console.log("Getting token access_token:", accessToken);  // Log the token
        
        if (accessToken) {
            config.headers["Authorization"] = `Bearer ${accessToken}`;
            console.log("Added Authorization header:", config.headers["Authorization"]);
        } else {
            console.warn("No access token found in localstorage")
        }

        return config;
    };

    /**
     * Response interceptor to handle token updates and other response modifications.
     */
    const responseInterceptor = (response) => {
        console.log("Intercepting response:", response.config.url);

        // Store access and refresh tokens if they are present in the response
        const accessToken = response.data.access;
        const refreshToken = response.data.refresh;

        if (accessToken) {
            setToken("access_token", accessToken);
            console.log("Access token set:", accessToken);
            console.log("Access token in localStorage:", localStorage.getItem('access_token'));  // Check if stored
        }

        if (refreshToken) {
            setToken("refresh_token", refreshToken, { expires: 7 });  // Store the refresh token
            console.log("Refresh token set:", refreshToken);
            console.log("Refresh token in localStorage:", localStorage.getItem('refresh_token'));  // Check if stored
        }

        // Handle logout scenario
        if (response.config.url.includes("/logout/")) {
            console.log("User logged out, clearing tokens.");
            removeToken("access_token");
            removeToken("refresh_token");
            Cookies.remove("csrftoken");
            Cookies.remove("sessionid");
        }

        return response;
    };

    /**
     * Response error interceptor to handle token expiration and refresh logic.
     */
    const responseErrorInterceptor = async (error) => {
        console.error("Response error intercepted:", error.response?.status);

        const originalRequest = error.config;

        // Handle expired access tokens and attempt to refresh them ONCE
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            console.log("Attempting token refresh.");

            try {
                const response = await authAxios.post("/token/refresh/", {}, { withCredentials: true });

                if (response.status === 200) {
                    const newAccessToken = response.data.access;
                    console.log("Setting refreshed access token:", newAccessToken);
                    setToken("access_token", newAccessToken);

                    // Update the auth headers with new access token
                    originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
                    return authAxios(originalRequest); // Retry original request with new token
                }
            } catch (refreshError) {
                console.error("Failed to refresh access token:", refreshError);
                handleAuthError();
            }
        }

        handleAuthError();
        return Promise.reject(error);
    };

    /**
     * useEffect to set up Axios interceptors and clean up on component unmount.
     */
    useEffect(() => {
        console.log("Setting up Axios interceptors.");
        const reqInterceptor = authAxios.interceptors.request.use(requestInterceptor, (error) => Promise.reject(error));
        const resInterceptor = authAxios.interceptors.response.use(responseInterceptor, responseErrorInterceptor);
    
        return () => {
            console.log("Cleaning up Axios interceptors.");
            authAxios.interceptors.request.eject(reqInterceptor);
            authAxios.interceptors.response.eject(resInterceptor);
        };
    }, [authAxios, navigate]);

    return { authAxios, setToken, getToken, removeToken };
};

export default useAuthAxios;


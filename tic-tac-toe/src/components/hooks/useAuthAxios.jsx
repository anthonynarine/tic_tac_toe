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
        withCredentials: true, // Always true, for both environments
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
                ...options,
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
        return isProduction ? Cookies.get(name) : localStorage.getItem(name);
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
        removeToken("access_token");
        removeToken("refresh_token");
        Cookies.remove("csrftoken");
        Cookies.remove("sessionid");
        navigate("/login");
    };

    /**
     * Request interceptor to attach access token and CSRF token to request headers.
     */
    const requestInterceptor = (config) => {
        const accessToken = getToken("access_token");
        if (accessToken) {
            config.headers["Authorization"] = `Bearer ${accessToken}`;
            console.log("Added Authorization header:", config.headers["Authorization"]);
        } else {
            console.warn("No access token found.");
        }
        return config;
    };

    /**
     * Response interceptor to handle token updates and other response modifications.
     */
    const responseInterceptor = (response) => {
        const accessToken = response.data.access;
        const refreshToken = response.data.refresh;

        if (accessToken) {
            setToken("access_token", accessToken);
            console.log("Access token set:", accessToken);
        }

        if (refreshToken) {
            setToken("refresh_token", refreshToken, { expires: 7 });
            console.log("Refresh token set:", refreshToken);
        }

        // Handle logout scenario
        if (response.config.url.includes("/logout/")) {
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
        const originalRequest = error.config;

        // Handle expired access tokens and attempt to refresh them ONCE
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            console.log("Attempting token refresh.");

            const refreshToken = getToken("refresh_token");
            if (!refreshToken) {
                console.log("No refresh token available. Logging out.");
                handleAuthError();
                return Promise.reject(error);
            }

            try {
                const response = await authAxios.post("/token/refresh/", {}, { withCredentials: true });
                if (response.status === 200) {
                    const newAccessToken = response.data.access;
                    setToken("access_token", newAccessToken);
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

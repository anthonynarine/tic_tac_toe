import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import Cookies from "js-cookie";
import authAxios from "../auth/authAxios";

let refreshTokenPromise = null;

const useAuthAxios = () => {
    const navigate = useNavigate();
    const isProduction = process.env.NODE_ENV === "production";

    /**
     * Set a token in either cookies or localStorage depending on environment.
     *
     * Args:
     *   name (string): Token name.
     *   value (string): Token value.
     *   options (object): Additional options (e.g., cookie expiration).
     */
    const setToken = (name, value, options = {}) => {
        if (isProduction) {
            Cookies.set(name, value, {
                secure: true,
                sameSite: "None",
                expires: name === "refresh_token" ? 7 : undefined,
                ...options,
            });
        } else {
            localStorage.setItem(name, value);
        }
    };

    /**
     * Retrieve a token from cookies or localStorage.
     *
     * Args:
     *   name (string): Token name.
     *
     * Returns:
     *   string|null: The token value if found, otherwise null.
     */
    const getToken = (name) => {
        return isProduction ? Cookies.get(name) : localStorage.getItem(name);
    };

    /**
     * Remove a token from cookies or localStorage.
     *
     * Args:
     *   name (string): Token name.
     */
    const removeToken = (name) => {
        if (isProduction) {
            Cookies.remove(name);
        } else {
            localStorage.removeItem(name);
        }
    };

    /**
     * Clear all auth-related tokens and redirect to login.
     */
    const handleAuthError = () => {
        removeToken("access_token");
        removeToken("refresh_token");
        Cookies.remove("csrftoken");
        Cookies.remove("sessionid");
        navigate("/login");
    };

    /**
     * Attach access token to outgoing request headers.
     *
     * Args:
     *   config (object): Axios request configuration.
     *
     * Returns:
     *   object: Modified request config with Authorization header.
     */
    const requestInterceptor = (config) => {
        const accessToken = getToken("access_token");
        if (accessToken) {
            config.headers["Authorization"] = `Bearer ${accessToken}`;
        }
        return config;
    };

    /**
     * Handle token storage after successful login or refresh.
     *
     * Args:
     *   response (object): Axios response object.
     *
     * Returns:
     *   object: The original response.
     */
    const responseInterceptor = (response) => {
        const accessToken = response.data.access;
        const refreshToken = response.data.refresh;

        if (accessToken) {
            setToken("access_token", accessToken);
        }

        if (refreshToken) {
            setToken("refresh_token", refreshToken, { expires: 7 });
        }

        if (response.config.url.includes("/logout/")) {
            removeToken("access_token");
            removeToken("refresh_token");
            Cookies.remove("csrftoken");
            Cookies.remove("sessionid");
        }

        return response;
    };

    /**
     * Handle 401 errors and attempt to refresh the token.
     * Ensures only one refresh request is sent even if multiple fail.
     *
     * Args:
     *   error (object): Axios error object.
     *
     * Returns:
     *   Promise: Retry of original request or logout on failure.
     */
    const responseErrorInterceptor = async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const refreshToken = getToken("refresh_token");
            if (!refreshToken) {
                handleAuthError();
                return Promise.reject(error);
            }

            if (!refreshTokenPromise) {
                refreshTokenPromise = authAxios.post(
                    "/token/refresh/",
                    { refresh: refreshToken },
                    { withCredentials: true }
                );
            }

            try {
                const response = await refreshTokenPromise;
                refreshTokenPromise = null;

                const newAccessToken = response.data.access;
                setToken("access_token", newAccessToken);
                originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
                return authAxios(originalRequest);
            } catch (refreshError) {
                refreshTokenPromise = null;
                handleAuthError();
            }
        }

        return Promise.reject(error);
    };

    /**
     * useEffect to attach Axios interceptors on mount and clean them up on unmount.
     * Also restores Authorization header from stored access token.
     */
    useEffect(() => {
        const existingAccessToken = getToken("access_token");
        if (existingAccessToken) {
            authAxios.defaults.headers.common["Authorization"] = `Bearer ${existingAccessToken}`;
        }

        const reqInterceptor = authAxios.interceptors.request.use(
            requestInterceptor,
            (error) => Promise.reject(error)
        );

        const resInterceptor = authAxios.interceptors.response.use(
            responseInterceptor,
            responseErrorInterceptor
        );

        return () => {
            authAxios.interceptors.request.eject(reqInterceptor);
            authAxios.interceptors.response.eject(resInterceptor);
        };
    }, [navigate]);

    return { authAxios, setToken, getToken, removeToken };
};

export default useAuthAxios;

// # Filename: src/components/auth/ensureFreshAccessToken.js


import publicAxios from "../auth/publicAxios";
import { getToken, setToken, removeToken } from "./tokenStore";

// Step 1: Decode JWT safely
const decodeJwtPayload = (token) => {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;

    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

    return JSON.parse(atob(padded));
  } catch (err) {
    return null;
  }
};

// Step 2: Refresh access token using refresh token
const refreshAccessToken = async () => {
  const refresh = getToken("refresh_token");
  if (!refresh) return null;

  try {
    const resp = await publicAxios.post("/token/refresh/", { refresh });
    const newAccess = resp.data?.access;

    if (newAccess) {
      setToken("access_token", newAccess);
      return newAccess;
    }

    return null;
  } catch (err) {
    // Step 3: If refresh fails, clear tokens (prevents infinite loops)
    removeToken("access_token");
    removeToken("refresh_token");
    return null;
  }
};

// Step 4: Ensure access token is valid for at least N seconds
export const ensureFreshAccessToken = async ({ minTtlSeconds = 60 } = {}) => {
  const access = getToken("access_token");

  // Step 1: If no access, try refresh (handles “refresh exists but access missing”)
  if (!access) {
    return await refreshAccessToken();
  }

  // Step 2: Check expiry
  const payload = decodeJwtPayload(access);
  const expMs = payload?.exp ? payload.exp * 1000 : 0;

  // If payload missing exp, treat as unsafe and refresh
  if (!expMs) {
    return await refreshAccessToken();
  }

  const nowMs = Date.now();
  const ttlMs = expMs - nowMs;

  // Step 3: If token is expiring soon, refresh before connecting WS
  if (ttlMs < minTtlSeconds * 1000) {
    return await refreshAccessToken();
  }

  return access;
};

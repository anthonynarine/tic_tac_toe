// # Filename: src/components/auth/tokenStore.js

import Cookies from "js-cookie";
import { AUTH_MODES, getAuthMode } from "./authMode";

// Step 1: Set token (cookie/local/session aware)
export const setToken = (name, value, options = {}) => {
  const mode = getAuthMode();

  if (mode === AUTH_MODES.SESSION) {
    sessionStorage.setItem(name, value);
    return;
  }

  if (mode === AUTH_MODES.LOCAL) {
    localStorage.setItem(name, value);
    return;
  }

  // Step 1a: COOKIE mode (prod default)
  Cookies.set(name, value, {
    secure: true,
    sameSite: "None",
    expires: name === "refresh_token" ? 7 : undefined,
    ...options,
  });
};

// Step 2: Get token (cookie/local/session aware)
export const getToken = (name) => {
  const mode = getAuthMode();

  if (mode === AUTH_MODES.SESSION) return sessionStorage.getItem(name);
  if (mode === AUTH_MODES.LOCAL) return localStorage.getItem(name);

  return Cookies.get(name) || null;
};

// Step 3: Remove token (cookie/local/session aware)
export const removeToken = (name) => {
  const mode = getAuthMode();

  if (mode === AUTH_MODES.SESSION) {
    sessionStorage.removeItem(name);
    return;
  }

  if (mode === AUTH_MODES.LOCAL) {
    localStorage.removeItem(name);
    return;
  }

  Cookies.remove(name);
};

// Step 4: Optional cleanup helper for legacy cookie auth bits
export const clearAuthCookies = () => {
  Cookies.remove("csrftoken");
  Cookies.remove("sessionid");
};

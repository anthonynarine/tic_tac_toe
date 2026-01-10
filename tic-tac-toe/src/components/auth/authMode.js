// # Filename: src/components/auth/authMode.js
// ✅ New Code

// Step 1: Define auth mode keys
const AUTH_MODE_KEY = "ttt_auth_mode";

// Step 2: Enumerate available modes
export const AUTH_MODES = {
  COOKIE: "cookie",
  LOCAL: "local",
  SESSION: "session",
};

// Step 3: Determine current mode (Recruiter Mode overrides everything)
export const getAuthMode = () => {
  const tabMode = sessionStorage.getItem(AUTH_MODE_KEY);

  if (tabMode === AUTH_MODES.SESSION) {
    return AUTH_MODES.SESSION;
  }

  // Default behavior preserved
  if (process.env.NODE_ENV === "development") {
    return AUTH_MODES.LOCAL;
  }

  return AUTH_MODES.COOKIE;
};

// Step 4: Enable recruiter mode for this tab only
export const enableRecruiterModeForTab = () => {
  sessionStorage.setItem(AUTH_MODE_KEY, AUTH_MODES.SESSION);
};

// Step 5: Disable recruiter mode for this tab only
export const disableRecruiterModeForTab = () => {
  sessionStorage.removeItem(AUTH_MODE_KEY);
};

// Step 6: Convenience helper
export const isRecruiterMode = () => getAuthMode() === AUTH_MODES.SESSION;

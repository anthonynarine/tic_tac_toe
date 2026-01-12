// # Filename: src/components/recruiter/RecruiterDemoPage.jsx

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

// # Step 1: Axios instances
import publicAxios from "../auth/publicAxios";
import authAxios from "../auth/authAxios";

// # Step 2: Auth helper (must export loginWithTokens from useAuth)
import { useAuth } from "../auth/hooks/useAuth";

// # Step 3: Recruiter mode + token store
import {
  enableRecruiterModeForTab,
  disableRecruiterModeForTab,
  isRecruiterMode,
} from "../auth/authMode";

import {
  getToken,
  removeToken,
  clearAuthCookies,
} from "../auth/tokenStore";

// # Step 4: CSS module
import styles from "./RecruiterDemoPage.module.css";

// # Step 5: Wizard constants (localStorage = cross-tab signaling only; no tokens)
const READY_KEYS = {
  player1: "recruiter:ready:player1",
  player2: "recruiter:ready:player2",
};

const getRoleFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const role = params.get("role");
  return role === "player2" ? "player2" : "player1";
};

const readReady = (key) => {
  const raw = window.localStorage.getItem(key);
  return raw ? Number(raw) : null;
};

const writeReady = (key) => {
  window.localStorage.setItem(key, String(Date.now()));
};

const removeReady = (key) => {
  window.localStorage.removeItem(key);
};

const RecruiterDemoPage = () => {
  const navigate = useNavigate();
  const { loginWithTokens } = useAuth();

  // # Step 1: Tab role (player1 default, player2 if URL says so)
  const role = useMemo(() => getRoleFromUrl(), []);

  // # Step 2: Local UI state
  const [loading, setLoading] = useState(false);
  const [activeUser, setActiveUser] = useState(null);

  const [p1Ready, setP1Ready] = useState(() => readReady(READY_KEYS.player1));
  const [p2Ready, setP2Ready] = useState(() => readReady(READY_KEYS.player2));

  const [logs, setLogs] = useState([
    {
      level: "ok",
      label: "system",
      text:
        role === "player1"
          ? "Step 1: Login Player 1 in THIS tab."
          : "Step 3: Login Player 2 in THIS tab.",
    },
  ]);

  // # Step 3: BaseURL sanity (avoid /api/api mistakes) — fixed to NEVER create leading slash problems
  const apiPrefix = useMemo(() => {
    const baseURL = (publicAxios?.defaults?.baseURL || "").replace(/\/+$/, "");
    return baseURL.endsWith("/api") ? "" : "/api";
  }, []);

  const buildApiPath = useCallback(
    (suffix) => {
      // If baseURL already ends with /api -> apiPrefix="" -> use suffix WITHOUT leading slash
      if (!apiPrefix) return suffix;
      // Otherwise prefix with /api
      return `${apiPrefix}/${suffix}`.replace(/\/+/g, "/");
    },
    [apiPrefix]
  );

  const DEMO_ENDPOINTS = useMemo(
    () => ({
      player1: buildApiPath("demo/login/player1/"),
      player2: buildApiPath("demo/login/player2/"),
    }),
    [buildApiPath]
  );

  const PROFILE_ENDPOINT = useMemo(
    () => buildApiPath("users/profile/"),
    [buildApiPath]
  );

  // # Step 4: Cross-tab listener (storage event fires across tabs)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === READY_KEYS.player1) setP1Ready(readReady(READY_KEYS.player1));
      if (e.key === READY_KEYS.player2) setP2Ready(readReady(READY_KEYS.player2));
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // # Step 5: Logging helpers
  const pushLog = (level, label, text) => {
    setLogs((prev) => [...prev, { level, label, text }]);
  };

  const getFriendlyError = (error) => {
    if (!error?.response) {
      return "Network error. Check API base URL / backend availability.";
    }

    const status = error.response.status;

    if (status === 404) {
      return "Endpoint not found (404). Confirm DEMO_MODE=true and routes exist under /api/demo/login/...";
    }

    if (status === 403) return "Forbidden (403). DEMO_MODE may be false or blocked by permission.";
    if (status === 429) return "Too many attempts (429). Endpoint is throttled.";
    if (status === 401) return "Unauthorized (401). Token missing/invalid.";

    return `Request failed (${status}).`;
  };

  // # Step 6: Wizard state (derived)
  const bothReady = Boolean(p1Ready && p2Ready);
  const thisRoleReady = role === "player1" ? Boolean(p1Ready) : Boolean(p2Ready);

  // We consider “logged in” for this tab as: activeUser exists OR access token exists
  // (activeUser will be set when loginWithTokens successfully loads profile)
  const hasAccessToken = Boolean(getToken("access_token"));
  const isLoggedInThisTab = Boolean(activeUser) || hasAccessToken;

  const instruction = useMemo(() => {
    if (!isLoggedInThisTab) {
      return role === "player1"
        ? "Step 1: Login as Player 1 in THIS tab."
        : "Step 3: Login as Player 2 in THIS tab.";
    }

    if (role === "player1" && !p2Ready) {
      return "Step 2: Open the Player 2 tab. Then login as Player 2 in that tab.";
    }

    if (!bothReady) {
      return "Waiting for the other tab to log in...";
    }

    return "Step 4: Click Home in BOTH tabs to start a game (Lobby/Multiplayer).";
  }, [bothReady, isLoggedInThisTab, p2Ready, role]);

  // # Step 7: Actions
  const handleGoHome = async () => {
    pushLog("ok", "nav", "Navigating to /");
    navigate("/");
  };

  const handleOpenPlayer2Tab = async () => {
    pushLog("ok", "tab", "Opening Player 2 tab: /recruiter?role=player2");
    window.open("/recruiter?role=player2", "_blank", "noopener,noreferrer");
  };

  const handleResetWizard = async () => {
    removeReady(READY_KEYS.player1);
    removeReady(READY_KEYS.player2);
    setP1Ready(null);
    setP2Ready(null);
    pushLog("ok", "system", "Wizard reset (both ready flags cleared).");
  };

  const handleLogoutThisTab = async () => {
    // # Step 1: Clear tokens for current mode
    removeToken("access_token");
    removeToken("refresh_token");

    // # Step 2: Clear legacy cookies (safe no-op if not used)
    clearAuthCookies();

    // # Step 3: Disable recruiter override for this tab
    disableRecruiterModeForTab();

    // # Step 4: Clear ready flag for this role (keeps wizard honest)
    if (role === "player1") {
      removeReady(READY_KEYS.player1);
      setP1Ready(null);
    } else {
      removeReady(READY_KEYS.player2);
      setP2Ready(null);
    }

    // # Step 5: Reset UI state
    setActiveUser(null);
    pushLog("ok", "auth", "Logged out (this tab only).");

    // # Step 6: Hard refresh to reset any in-memory state
    window.location.reload();
  };

  const handleCheckProfile = async () => {
    setLoading(true);

    try {
      const access = getToken("access_token");

      if (!access) {
        pushLog("error", "auth", "No access token found for this tab.");
        return;
      }

      const profileResp = await authAxios.get(PROFILE_ENDPOINT, {
        headers: { Authorization: `Bearer ${access}` },
        withCredentials: false,
      });

      setActiveUser(profileResp.data);
      pushLog("ok", "api", "Profile fetched successfully.");
    } catch (error) {
      pushLog("error", "api", getFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleLoginThisTab = async () => {
    setLoading(true);

    try {
      // # Step 1: Enable recruiter mode (sessionStorage tokens per tab)
      enableRecruiterModeForTab();

      pushLog(
        "ok",
        "auth",
        `Recruiter Mode ON → requesting demo tokens for ${role}...`
      );

      // # Step 2: Get tokens from backend demo endpoint
      const tokenResp = await publicAxios.post(DEMO_ENDPOINTS[role], null, {
        withCredentials: false,
      });

      const { access, refresh } = tokenResp.data || {};
      if (!access || !refresh) {
        pushLog("error", "auth", "Demo endpoint did not return { access, refresh }.");
        return;
      }

      // # Step 3: IMPORTANT — complete auth pipeline via useAuth
      // This sets: tokens + user + isLoggedIn=true (prevents Home redirect to /login)
      const userData = await loginWithTokens({ access, refresh });
      setActiveUser(userData);

      // # Step 4: Mark readiness (localStorage only = cross-tab signal)
      writeReady(role === "player1" ? READY_KEYS.player1 : READY_KEYS.player2);
      if (role === "player1") setP1Ready(readReady(READY_KEYS.player1));
      if (role === "player2") setP2Ready(readReady(READY_KEYS.player2));

      pushLog("ok", "system", `${role} ready ✅`);
    } catch (error) {
      pushLog("error", "api", getFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  // # Step 8: Render helpers
  const getLineClass = (level) => {
    if (level === "error") return `${styles.line} ${styles.lineError}`;
    if (level === "ok") return `${styles.line} ${styles.lineOk}`;
    return styles.line;
  };

  return (
    <div className={styles.page}>
      <div className={styles.terminal}>
        {/* # Step 1: Header */}
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <div className={styles.title}>Recruiter Demo Mode</div>
            <div className={styles.subtitle}>
              Wizard • two tabs • per-tab sessionStorage tokens • no incognito
            </div>
          </div>

          <div className={styles.headerRight}>
            <div className={styles.modePill}>
              Role: <span className={styles.modeValue}>{role}</span>
            </div>

            <div className={styles.modePill} style={{ marginLeft: 10 }}>
              Mode:{" "}
              <span className={styles.modeValue}>
                {isRecruiterMode() ? "ON" : "OFF"}
              </span>
            </div>
          </div>
        </div>

        {/* # Step 2: Content */}
        <div className={styles.content}>
          {/* Left panel */}
          <div className={styles.panel}>
            <div className={styles.panelTitle}>Wizard</div>

            <div className={styles.helpBox}>
              <div className={styles.helpTitle}>Steps</div>

              <div className={styles.helpText}>{instruction}</div>

              <div className={styles.helpText} style={{ marginTop: 10 }}>
                Player 1:{" "}
                <span className={styles.mono}>{p1Ready ? "✅ Ready" : "❌ Not ready"}</span>{" "}
                • Player 2:{" "}
                <span className={styles.mono}>{p2Ready ? "✅ Ready" : "❌ Not ready"}</span>
              </div>

              {activeUser && (
                <div className={styles.helpText} style={{ marginTop: 10 }}>
                  This tab logged in as{" "}
                  <span className={styles.mono}>
                    {activeUser.email || activeUser.id || "demo user"}
                  </span>
                </div>
              )}
            </div>

            <div className={styles.buttonGrid}>
              {/* # Step 3: Primary login button (role-specific) */}
              <button
                className={styles.primaryButton}
                onClick={async () => await handleLoginThisTab()}
                disabled={loading || thisRoleReady}
              >
                {loading
                  ? "Working..."
                  : role === "player1"
                  ? "Login Player 1 (This Tab)"
                  : "Login Player 2 (This Tab)"}
              </button>

              {/* # Step 4: Player 1 only — open Player 2 tab */}
              {role === "player1" && (
                <button
                  className={styles.ghostButton}
                  onClick={async () => await handleOpenPlayer2Tab()}
                  disabled={loading || !isLoggedInThisTab || Boolean(p2Ready)}
                >
                  Open Player 2 Tab
                </button>
              )}

              {/* # Step 5: Go Home only when both tabs are ready */}
              <button
                className={styles.ghostButton}
                onClick={async () => await handleGoHome()}
                disabled={loading || !bothReady}
              >
                Go Home (do this in BOTH tabs)
              </button>

              <button
                className={styles.ghostButton}
                onClick={async () => await handleCheckProfile()}
                disabled={loading}
              >
                Check Profile
              </button>

              <button
                className={styles.ghostButton}
                onClick={async () => await handleResetWizard()}
                disabled={loading}
              >
                Reset Wizard
              </button>

              <button
                className={styles.dangerButton}
                onClick={async () => await handleLogoutThisTab()}
                disabled={loading}
              >
                Logout This Tab
              </button>
            </div>
          </div>

          {/* Right panel: Terminal Log */}
          <div className={styles.panel}>
            <div className={styles.panelTitle}>Terminal Log</div>

            <div className={styles.log}>
              {logs.map((line, idx) => (
                <div key={idx} className={getLineClass(line.level)}>
                  <span className={styles.prompt}>&gt;</span>
                  <span className={styles.label}>{line.label}</span>
                  <span className={styles.text}>{line.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* end content */}
      </div>
    </div>
  );
};

export default RecruiterDemoPage;

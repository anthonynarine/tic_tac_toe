// # Filename: src/components/lobby/LobbyPage.jsx
// ✅ New Code

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { IoIosSend } from "react-icons/io";
import { CiCirclePlus } from "react-icons/ci";

import { useLobbyContext } from "../../../context/lobbyContext";
import { useFriends } from "../../../context/friendsContext";
import { useUserContext } from "../../../context/userContext";

import { showToast } from "../../../utils/toast/Toast";
import { ensureFreshAccessToken } from "../../../auth/ensureFreshAccessToken";

import { getLobbyWSUrl, getChatWSUrl } from "../../../websocket/getWebsocketURL";
import { createInvite } from "../../../api/inviteApi";
import { pokerApi } from "../../../api/pokerApi";
import { resolveRecipientUserId } from "../../../invites/resolveRecipientUserId";

import InviteFriendModal from "./InviteFriendModal";

const GAME_TYPE_LABELS = {
  tic_tac_toe: "Tic-Tac-Toe",
  connect_four: "Connect Four",
  checkers: "Checkers",
  poker: "Poker",
};

const DEFAULT_POKER_SETTINGS = {
  starting_chips: 1000,
  small_blind: 10,
  big_blind: 20,
  turn_timer_seconds: 45,
  max_players: 9,
  can_update_settings: false,
};

// -------------------------------------
// Theme primitives (DMDrawer style)
// -------------------------------------
function HudShell({ children }) {
  return (
    <div className="w-full h-full min-h-0 px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
      <div className="mx-auto max-w-[1120px]">
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.30]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.18),transparent_45%),radial-gradient(circle_at_85%_10%,rgba(34,211,238,0.12),transparent_45%),radial-gradient(circle_at_50%_92%,rgba(34,211,238,0.10),transparent_52%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(34,211,238,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,211,238,0.05)_1px,transparent_1px)] bg-[size:36px_36px]" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, right, children, className = "" }) {
  return (
    <section
      className={[
        "relative overflow-hidden rounded-2xl",
        "border border-brand-cyan/15 bg-background-app-panel/70",
        "shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_0_32px_rgba(34,211,238,0.06)]",
        "backdrop-blur-[2px]",
        "flex flex-col p-4 sm:p-5",
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/5 to-transparent" />
      <header className="relative mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold tracking-wide text-text-primary">
          {title}
        </div>
        {right ? <div className="text-xs text-text-secondary">{right}</div> : null}
      </header>
      <div className="relative min-h-0 flex-1">{children}</div>
    </section>
  );
}

function HudButton({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
  title,
}) {
  const base =
    "rounded-xl px-3 py-2 text-xs font-medium transition border focus:outline-none focus:ring-2 active:translate-y-[1px]";

  const styles = {
    primary: disabled
      ? "border-brand-cyan/15 bg-brand-cyan/5 text-brand-cyan/35 cursor-not-allowed"
      : "border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/15 focus:ring-brand-cyan/20",
    danger: disabled
      ? "border-brand-rose/15 bg-brand-rose/5 text-brand-rose/35 cursor-not-allowed"
      : "border-brand-rose/25 bg-brand-rose/10 text-brand-rose hover:bg-brand-rose/15 focus:ring-brand-rose/20",
    neutral: disabled
      ? "border-border-soft bg-surface text-text-faint cursor-not-allowed"
      : "border-border-soft bg-surface text-text-secondary hover:bg-surface-elevated focus:ring-border-strong",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[base, styles[variant] || styles.primary, className].join(" ")}
    >
      {children}
    </button>
  );
}

function SegTab({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition",
        active
          ? "border-brand-cyan/25 bg-brand-cyan/12 text-brand-cyan"
          : "border-border-soft bg-surface text-text-secondary hover:bg-surface-elevated",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function StatusDot({ ok }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px]",
        ok
          ? "border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan/90"
          : "border-border-soft bg-surface text-text-faint",
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          ok
            ? "bg-brand-cyan shadow-glow-cyan"
            : "bg-text-faint/40",
        ].join(" ")}
      />
      {ok ? "Connected" : "Connecting"}
    </span>
  );
}

function PokerSettingsPanel({
  settings,
  onChange,
  onSave,
  saving,
  playerCount,
  className = "",
}) {
  const locked = !settings?.can_update_settings;
  const fields = [
    { key: "starting_chips", label: "Starting Stack", min: 500, max: 10000, step: 100 },
    { key: "small_blind", label: "Small Blind", min: 5, max: 500, step: 5 },
    { key: "big_blind", label: "Big Blind", min: 10, max: 1000, step: 10 },
    { key: "turn_timer_seconds", label: "Turn Timer", min: 15, max: 120, step: 5 },
  ];

  return (
    <div className={[
      "rounded-2xl border border-emerald-300/15 bg-[linear-gradient(145deg,rgba(15,23,42,0.9),rgba(2,6,23,0.72))] p-4",
      className,
    ].join(" ")}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-text-primary">Table Setup</div>
          <div className="mt-1 text-[11px] text-text-secondary">
            Locked when the first hand starts.
          </div>
        </div>
        <span className="whitespace-nowrap rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
          {playerCount}/{settings.max_players}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className="block">
            <span className="text-[11px] uppercase tracking-[0.16em] text-text-faint">
              {field.label}
            </span>
            <input
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              value={settings[field.key]}
              disabled={locked}
              onChange={(e) => onChange(field.key, e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-white/[0.07] bg-surface px-3 text-sm font-semibold text-text-primary outline-none transition focus:border-emerald-300/40 disabled:opacity-55"
            />
          </label>
        ))}

        <label className="block sm:col-span-2">
          <span className="text-[11px] uppercase tracking-[0.16em] text-text-faint">
            Max Seats
          </span>
          <div className="mt-1 grid grid-cols-4 gap-1.5 sm:grid-cols-8">
            {[2, 3, 4, 5, 6, 7, 8, 9].map((seatCount) => (
              <button
                key={seatCount}
                type="button"
                disabled={locked || seatCount < playerCount}
                onClick={() => onChange("max_players", seatCount)}
                className={[
                  "h-10 rounded-xl border text-sm font-semibold transition",
                  Number(settings.max_players) === seatCount
                    ? "border-emerald-300/35 bg-emerald-300/15 text-emerald-100"
                    : "border-white/[0.07] bg-surface text-text-secondary hover:bg-surface-elevated",
                  locked || seatCount < playerCount ? "cursor-not-allowed opacity-45" : "",
                ].join(" ")}
              >
                {seatCount}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-[11px] text-text-faint">
          {locked ? "Only the host can edit before start." : "Host controls are active."}
        </div>
        <HudButton
          onClick={onSave}
          disabled={locked || saving}
          variant="primary"
          className="border-emerald-300/25 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/15"
        >
          {saving ? "Saving" : "Save"}
        </HudButton>
      </div>
    </div>
  );
}

// -------------------------------------
// LobbyPage
// -------------------------------------
export default function LobbyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { gameType, id: lobbyId } = useParams();

  const { state, dispatch } = useLobbyContext();
  const { friends = [] } = useFriends();
  const { user } = useUserContext();

  const [message, setMessage] = useState("");
  const [activeMobileTab, setActiveMobileTab] = useState("players"); // "players" | "chat"
  const [pokerSettings, setPokerSettings] = useState(DEFAULT_POKER_SETTINGS);
  const [isSavingPokerSettings, setIsSavingPokerSettings] = useState(false);
  const [isPokerSettingsOpen, setIsPokerSettingsOpen] = useState(false);

  // Modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  // WS refs
  const lobbyWsRef = useRef(null);
  const chatWsRef = useRef(null);

  const [lobbyConnected, setLobbyConnected] = useState(false);
  const [chatConnected, setChatConnected] = useState(false);

  const chatContainerRef = useRef(null);

  const MAX_PLAYERS = gameType === "poker" ? Number(pokerSettings.max_players || 9) : 2;
  const players = useMemo(() => state?.players || [], [state?.players]);
  const messages = useMemo(() => state?.messages || [], [state?.messages]);

  const isLobbyFull = useMemo(() => players.length >= MAX_PLAYERS, [MAX_PLAYERS, players]);
  const canStartGame = gameType === "poker" ? players.length >= 2 : isLobbyFull;

  const onlineFriends = useMemo(
    () => (friends || []).filter((f) => f?.friend_status === "online"),
    [friends]
  );

  useEffect(() => {
    let cancelled = false;
    const fetchPokerSettings = async () => {
      if (gameType !== "poker" || !lobbyId) {
        setPokerSettings(DEFAULT_POKER_SETTINGS);
        return;
      }
      try {
        const data = await pokerApi.getGame(lobbyId);
        if (cancelled) return;
        setPokerSettings({
          starting_chips: data?.starting_chips || DEFAULT_POKER_SETTINGS.starting_chips,
          small_blind: data?.small_blind || DEFAULT_POKER_SETTINGS.small_blind,
          big_blind: data?.big_blind || DEFAULT_POKER_SETTINGS.big_blind,
          turn_timer_seconds: data?.turn_timer_seconds || DEFAULT_POKER_SETTINGS.turn_timer_seconds,
          max_players: data?.max_players || DEFAULT_POKER_SETTINGS.max_players,
          can_update_settings: Boolean(data?.can_update_settings),
        });
      } catch (error) {
        console.error("[LobbyPage] poker settings fetch failed:", error);
      }
    };
    fetchPokerSettings();
    return () => {
      cancelled = true;
    };
  }, [gameType, lobbyId]);

  // # Step 1: Safe close WS
  const safeClose = useCallback((wsRef) => {
    try {
      if (!wsRef?.current) return;
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    } catch {
      // ignore
    }
  }, []);

  // # Step 2: Session key helpers (namespaced by gameType so a TTT lobby and
  // a Connect Four lobby sharing the same numeric id never share a cached key)
  const getStoredSessionKey = useCallback(() => {
    if (!lobbyId) return null;
    return sessionStorage.getItem(`sessionKey:${gameType}:${lobbyId}`) || null;
  }, [gameType, lobbyId]);

  const setStoredSessionKey = useCallback((id, key) => {
    if (!id || !key) return;
    sessionStorage.setItem(`sessionKey:${gameType}:${String(id)}`, String(key));
  }, [gameType]);

  const buildGameUrl = useCallback(
    ({ gameId, sessionKey }) => {
      if (gameType === "connect_four") {
        return `/games/connect-four/${gameId}`;
      }
      if (gameType === "checkers") {
        return `/games/checkers/${gameId}`;
      }
      if (gameType === "poker") {
        return `/games/poker/${gameId}`;
      }
      const params = new URLSearchParams();
      if (sessionKey) params.set("sessionKey", String(sessionKey));
      if (lobbyId) params.set("lobbyId", String(lobbyId));
      const qs = params.toString();
      return qs ? `/games/${gameId}?${qs}` : `/games/${gameId}`;
    },
    [gameType, lobbyId]
  );

  // # Step 3: Boot WS
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        if (!lobbyId) return;

        safeClose(chatWsRef);
        safeClose(lobbyWsRef);
        setLobbyConnected(false);
        setChatConnected(false);

        const access = await ensureFreshAccessToken();
        if (!access || cancelled) return;

        const params = new URLSearchParams(location.search);
        const inviteId = params.get("invite");
        const sessionKeyFromUrl = params.get("sessionKey");
        const storedSessionKey = sessionStorage.getItem(`sessionKey:${gameType}:${lobbyId}`);

        const sessionKey = sessionKeyFromUrl || storedSessionKey || null;

        const lobbyUrl = getLobbyWSUrl({
          gameType,
          lobbyId,
          token: access,
          inviteId,
          sessionKey,
        });

        const chatUrl = getChatWSUrl({ gameType, lobbyId, token: access });

        // Lobby WS
        const lobbyWs = new WebSocket(lobbyUrl);
        lobbyWsRef.current = lobbyWs;

        lobbyWs.onopen = () => {
          if (cancelled) return;
          setLobbyConnected(true);
          try {
            lobbyWs.send(JSON.stringify({ type: "join_lobby" }));
          } catch {
            // ignore
          }
        };

        lobbyWs.onclose = () => {
          if (cancelled) return;
          setLobbyConnected(false);
        };

        lobbyWs.onmessage = (evt) => {
          if (cancelled) return;
          let data;
          try {
            data = JSON.parse(evt.data);
          } catch {
            return;
          }

          if (data?.type === "session_established") {
            const nextLobbyId = String(data?.lobbyId ?? lobbyId);
            const nextSessionKey = data?.sessionKey;

            if (nextLobbyId && nextSessionKey) {
              setStoredSessionKey(nextLobbyId, nextSessionKey);
              const next = new URLSearchParams(location.search);
              next.delete("invite");
              next.set("sessionKey", String(nextSessionKey));

              navigate(`/lobby/${gameType}/${nextLobbyId}?${next.toString()}`, {
                replace: true,
              });
            }
            return;
          }

          if (data?.type === "update_player_list") {
            dispatch({ type: "SET_PLAYERS", payload: data?.players || [] });
            return;
          }

          if (data?.type === "game_start_acknowledgment") {
            const gameId = data?.game_id || data?.gameId;
            if (!gameId) return;

            const ackSessionKey = data?.sessionKey || data?.session_key || null;
            const stableKey = ackSessionKey || getStoredSessionKey();

            if (ackSessionKey) setStoredSessionKey(lobbyId, ackSessionKey);

            navigate(buildGameUrl({ gameId, sessionKey: stableKey }), {
              replace: true,
            });
            return;
          }

          if (data?.type === "error") {
            showToast("error", data?.message || "Lobby error.");
          }
        };

        // Chat WS
        const chatWs = new WebSocket(chatUrl);
        chatWsRef.current = chatWs;

        chatWs.onopen = () => {
          if (cancelled) return;
          setChatConnected(true);
        };

        chatWs.onclose = () => {
          if (cancelled) return;
          setChatConnected(false);
        };

        chatWs.onmessage = (evt) => {
          if (cancelled) return;
          let data;
          try {
            data = JSON.parse(evt.data);
          } catch {
            return;
          }

          if (data?.type === "chat_message") {
            dispatch({ type: "ADD_MESSAGE", payload: data?.message ?? data });
            return;
          }

          if (data?.type === "error") {
            showToast("error", data?.message || "Chat error.");
          }
        };
      } catch (err) {
        console.error("[LobbyPage] WS boot failed:", err);
      }
    };

    boot();

    return () => {
      cancelled = true;
      safeClose(chatWsRef);
      safeClose(lobbyWsRef);
      setLobbyConnected(false);
      setChatConnected(false);
      dispatch({ type: "RESET_LOBBY" });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameType, lobbyId]);

  // # Step 4: Auto-scroll chat (when chat is visible)
  useEffect(() => {
    if (!chatContainerRef.current) return;
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [messages, activeMobileTab]);

  // -------------------------------------
  // Actions
  // -------------------------------------
  const handleCopyLink = useCallback(() => {
    const stableKey = getStoredSessionKey();
    const params = new URLSearchParams(location.search);

    if (stableKey) {
      params.delete("invite");
      params.set("sessionKey", String(stableKey));
    }

    navigator.clipboard.writeText(
      `${window.location.origin}/lobby/${gameType}/${lobbyId}?${params.toString()}`
    );
    showToast("success", "Link copied.");
  }, [getStoredSessionKey, gameType, lobbyId, location.search]);

  const handleInviteFriend = useCallback(
    async (friend) => {
      try {
        if (!user?.id || !lobbyId) return;

        const recipientUserId = resolveRecipientUserId(friend, user.id);
        if (!recipientUserId) return;
        if (Number(recipientUserId) === Number(user.id)) return;

        setIsInviting(true);

        const result = await createInvite({
          toUserId: recipientUserId,
          gameType,
          lobbyId,
        });

        const inviteId =
          result?.invite?.inviteId ||
          result?.invite?.id ||
          result?.inviteId ||
          result?.invite_id;

        if (!inviteId) {
          showToast("error", "Invite failed (missing inviteId).");
          return;
        }

        showToast("success", "Invite sent!");
        setIsInviteOpen(false);
      } catch (error) {
        console.error("Lobby invite: Failed:", error);
        showToast("error", "Invite failed.");
      } finally {
        setIsInviting(false);
      }
    },
    [lobbyId, gameType, user?.id]
  );

  const handleSendChat = useCallback(() => {
    const text = message.trim();
    if (!text) return;

    const ws = chatWsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showToast("error", "Chat not connected yet.");
      return;
    }

    ws.send(JSON.stringify({ type: "chat_message", message: text }));
    setMessage("");
  }, [message]);

  const handleStartGame = useCallback(() => {
    if (!canStartGame) {
      showToast("error", gameType === "poker" ? "Need at least 2 players to start." : "Need 2 players to start.");
      return;
    }

    const ws = lobbyWsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showToast("error", "Lobby not connected yet.");
      return;
    }

    ws.send(JSON.stringify({ type: "start_game" }));
  }, [canStartGame, gameType]);

  const handlePokerSettingChange = useCallback((key, value) => {
    setPokerSettings((prev) => ({ ...prev, [key]: Number(value) }));
  }, []);

  const handleSavePokerSettings = useCallback(async () => {
    if (gameType !== "poker" || !lobbyId) return;
    try {
      setIsSavingPokerSettings(true);
      const data = await pokerApi.updateSettings(lobbyId, {
        starting_chips: pokerSettings.starting_chips,
        small_blind: pokerSettings.small_blind,
        big_blind: pokerSettings.big_blind,
        turn_timer_seconds: pokerSettings.turn_timer_seconds,
        max_players: pokerSettings.max_players,
      });
      setPokerSettings({
        starting_chips: data?.starting_chips || pokerSettings.starting_chips,
        small_blind: data?.small_blind || pokerSettings.small_blind,
        big_blind: data?.big_blind || pokerSettings.big_blind,
        turn_timer_seconds: data?.turn_timer_seconds || pokerSettings.turn_timer_seconds,
        max_players: data?.max_players || pokerSettings.max_players,
        can_update_settings: Boolean(data?.can_update_settings),
      });
      showToast("success", "Poker settings saved.");
    } catch (error) {
      console.error("[LobbyPage] poker settings save failed:", error);
      showToast("error", error?.response?.data?.error || "Could not save poker settings.");
    } finally {
      setIsSavingPokerSettings(false);
    }
  }, [gameType, lobbyId, pokerSettings]);

  const handleLeaveLobby = useCallback(() => {
    try {
      lobbyWsRef.current?.send(JSON.stringify({ type: "leave_lobby" }));
    } catch {
      // ignore
    }
    navigate("/", { replace: true });
  }, [navigate]);

  // -------------------------------------
  // Render
  // -------------------------------------
  return (
    <HudShell>
      {/* Minimal header (mobile: calm) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.22em] text-brand-cyan/60">
              Lobby • {GAME_TYPE_LABELS[gameType] || gameType}
            </div>

            <div className="mt-1 flex items-baseline gap-2">
              <h1 className="text-lg sm:text-xl font-semibold text-text-primary">
                Lobby {lobbyId}
              </h1>
              <span className="hidden sm:inline text-xs text-text-secondary">
                Online friends: {onlineFriends.length}
              </span>
            </div>

            {/* Mobile: status compact */}
            <div className="mt-3 flex flex-wrap items-center gap-2 lg:hidden">
              <StatusDot ok={lobbyConnected} />
              <StatusDot ok={chatConnected} />
              <span className="text-[11px] text-text-faint">
                Online: {onlineFriends.length}
              </span>
            </div>

            {/* Desktop: richer info */}
            <div className="mt-3 hidden lg:flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-cyan/20 bg-brand-cyan/10 px-2.5 py-1 text-[11px] text-brand-cyan/90">
                Lobby WS: {lobbyConnected ? "LIVE" : "CONNECTING"}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-cyan/20 bg-brand-cyan/10 px-2.5 py-1 text-[11px] text-brand-cyan/90">
                Chat WS: {chatConnected ? "LIVE" : "CONNECTING"}
              </span>
              <span className="text-[11px] text-text-faint">
                Online friends: {onlineFriends.length}
              </span>
            </div>
          </div>

          {/* Desktop actions only (mobile actions are in bottom bar) */}
          <div className="hidden lg:flex items-center gap-2">
            <HudButton onClick={() => setIsInviteOpen(true)} variant="primary">
              Invite Friend
            </HudButton>
            <HudButton onClick={handleCopyLink} variant="neutral">
              Copy Link
            </HudButton>
            <HudButton onClick={handleLeaveLobby} variant="danger">
              Leave
            </HudButton>
          </div>
        </div>

        {/* Mobile: simple tabs to reduce clutter */}
        <div className="lg:hidden flex items-center gap-2">
          <div className="flex-1 flex gap-2 rounded-2xl border border-border-soft bg-surface p-2">
              <SegTab
              active={activeMobileTab === "players"}
              onClick={() => setActiveMobileTab("players")}
              label={`Players (${players.length}/${MAX_PLAYERS})`}
            />
            <SegTab
              active={activeMobileTab === "chat"}
              onClick={() => setActiveMobileTab("chat")}
              label="Chat"
            />
          </div>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Players: ALWAYS primary on mobile */}
          <div
            className={[
              "lg:col-span-5",
              activeMobileTab === "players" ? "block" : "hidden",
              "lg:block",
            ].join(" ")}
          >
              <Panel
                title="Players"
                className="lg:h-[536px]"
                right={
                  gameType === "poker" ? (
                    <div className="flex items-center gap-2">
                      <span className="whitespace-nowrap">{players.length}/{MAX_PLAYERS}</span>
                      <button
                        type="button"
                        onClick={() => setIsPokerSettingsOpen(true)}
                        className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-300/15"
                      >
                        Setup
                      </button>
                    </div>
                  ) : `${players.length}/${MAX_PLAYERS}`
                }
              >
              <div className="flex h-full min-h-0 flex-col">
              <div
                className={[
                  "space-y-2 pr-1",
                  gameType === "poker"
                    ? "min-h-0 flex-1 overflow-y-auto tron-scrollbar-dark"
                    : "",
                ].join(" ")}
              >
                {Array.from({ length: MAX_PLAYERS }).map((_, idx) => {
                  const p = players[idx];

                  if (!p) {
                    return (
                      <button
                        key={`slot-${idx}`}
                        type="button"
                        onClick={() => setIsInviteOpen(true)}
                        className={[
                          "group w-full text-left rounded-2xl",
                          "border border-dashed border-white/[0.08] bg-surface",
                          "px-4 py-4 transition",
                          "hover:border-emerald-300/20 hover:bg-surface-elevated",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-xl border border-brand-cyan/15 bg-brand-cyan/5">
                            <CiCirclePlus className="text-xl text-brand-cyan/80 group-hover:text-brand-cyan" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-text-faint">
                              Slot {idx + 1}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-text-secondary">
                              Invite player
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  }

                  return (
                    <div
                      key={String(p.id)}
                      className="rounded-2xl border border-white/[0.07] bg-surface px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-text-faint">
                            Player {idx + 1}
                          </div>
                          <div className="mt-1 truncate text-sm font-semibold text-text-primary">
                            {p.first_name || "Player"}
                          </div>
                          <div className="mt-1 text-[11px] text-text-faint">
                            Connected
                          </div>
                        </div>
                        <div className="mt-1 h-2 w-2 rounded-full bg-brand-cyan shadow-glow-cyan" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop extra controls inside panel */}
              <div className="mt-4 hidden shrink-0 lg:flex gap-2">
                  <HudButton
                  onClick={handleStartGame}
                  disabled={!canStartGame}
                  className="flex-1"
                >
                  Start Game
                </HudButton>
                <HudButton onClick={handleLeaveLobby} variant="neutral">
                  Exit
                </HudButton>
              </div>
              </div>
            </Panel>
          </div>

          {/* Chat: SMALL + optional on mobile */}
          <div
            className={[
              "lg:col-span-7",
              activeMobileTab === "chat" ? "block" : "hidden",
              "lg:block",
            ].join(" ")}
          >
            <Panel
              title="Lobby Chat"
              right={chatConnected ? "Connected" : "Connecting…"}
              className="lg:h-[536px]"
            >
              <div className="flex h-full min-h-0 flex-col gap-3">
                <div
                  ref={chatContainerRef}
                  className={[
                    "overflow-y-auto rounded-2xl border border-brand-cyan/10 bg-surface p-3 space-y-2 tron-scrollbar-dark",
                    // ✅ Mobile: much smaller, not a giant feed
                    "h-[28dvh] min-h-[180px] max-h-[260px]",
                    // ✅ Desktop: can be larger
                    "lg:h-auto lg:min-h-0 lg:max-h-none lg:flex-1",
                  ].join(" ")}
                >
                  {messages.length ? (
                    messages.map((m, idx) => {
                      const id = m?.id ? String(m.id) : null;
                      const sender = m?.sender || "User";
                      const content = m?.content || "";

                      const isMe =
                        m?.sender_id != null && user?.id != null
                          ? Number(m.sender_id) === Number(user.id)
                          : false;

                      return (
                        <div
                          key={id || `${sender}|${content}|${idx}`}
                          className={["flex", isMe ? "justify-end" : "justify-start"].join(
                            " "
                          )}
                        >
                          <div
                            className={[
                              "max-w-[88%] rounded-2xl px-3 py-2 text-sm border",
                              isMe
                                ? "border-brand-cyan/20 bg-brand-cyan/10 text-text-primary"
                                : "border-border-soft bg-surface-elevated text-text-primary",
                            ].join(" ")}
                          >
                            <div
                              className={[
                                "text-[11px]",
                                isMe ? "text-brand-cyan/85" : "text-text-secondary",
                              ].join(" ")}
                            >
                              {isMe ? "You" : sender}
                            </div>
                            <div className="mt-0.5 whitespace-pre-wrap break-words">
                              {content}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-text-secondary">
                      No messages yet.
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 rounded-2xl border border-brand-cyan/20 bg-surface px-3 py-2">
                    <input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                      placeholder={chatConnected ? "Type a message…" : "Connecting…"}
                      className="
                        flex-1 bg-transparent outline-none
                        text-sm text-text-primary
                        placeholder:text-text-faint
                      "
                    />

                    <button
                      type="button"
                      onClick={handleSendChat}
                      disabled={!message.trim() || !chatConnected}
                      className={[
                        "h-9 w-9 grid place-items-center rounded-xl border transition",
                        "border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan",
                        !message.trim() || !chatConnected
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-brand-cyan/15",
                      ].join(" ")}
                      title={!chatConnected ? "Chat connecting…" : "Send"}
                    >
                      <IoIosSend size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {/* ✅ Mobile bottom command bar (reduces clutter) */}
      <div
        className="
          lg:hidden
          fixed inset-x-0 bottom-0 z-[30]
          px-3 pb-[max(12px,env(safe-area-inset-bottom))]
        "
      >
        <div
          className="
            mx-auto max-w-[1120px]
            rounded-2xl border border-brand-cyan/15 bg-background-app-panel/90 backdrop-blur-xl
            shadow-glow-cyan
            p-2
            flex items-center gap-2
          "
        >
          <HudButton
            onClick={() => setIsInviteOpen(true)}
            className="flex-1"
            variant="primary"
          >
            Invite
          </HudButton>

          <HudButton
            onClick={handleStartGame}
            disabled={!canStartGame}
            className="flex-1"
            variant="primary"
            title={!canStartGame ? "Need more players" : "Start the match"}
          >
            Start
          </HudButton>

          <HudButton onClick={handleLeaveLobby} variant="neutral">
            Leave
          </HudButton>
        </div>
      </div>

      {/* Spacer so content doesn't hide behind mobile bar */}
      <div className="lg:hidden h-20" />

      {gameType === "poker" && isPokerSettingsOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-emerald-300/20 bg-background-app-panel shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-text-primary">Poker Table Setup</div>
                <div className="mt-1 text-[11px] text-text-secondary">
                  {players.length}/{MAX_PLAYERS}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPokerSettingsOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.07] bg-surface text-text-secondary transition hover:bg-surface-elevated hover:text-text-primary"
                title="Close setup"
              >
                X
              </button>
            </div>
            <div className="p-4">
              <PokerSettingsPanel
                settings={pokerSettings}
                onChange={handlePokerSettingChange}
                onSave={handleSavePokerSettings}
                saving={isSavingPokerSettings}
                playerCount={players.length}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Invite modal */}
      <InviteFriendModal
        open={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        friends={onlineFriends}
        onInvite={handleInviteFriend}
        lobbyId={lobbyId}
        isInviting={isInviting}
      />
    </HudShell>
  );
}

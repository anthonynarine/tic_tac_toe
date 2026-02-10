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
import { resolveRecipientUserId } from "../../../invites/resolveRecipientUserId";

import InviteFriendModal from "./InviteFriendModal";

// -------------------------------------
// Theme primitives (DMDrawer style)
// -------------------------------------
function HudShell({ children }) {
  return (
    <div className="w-full h-full min-h-0 px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
      <div className="mx-auto max-w-[1120px]">
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.30]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(29,161,242,0.18),transparent_45%),radial-gradient(circle_at_85%_10%,rgba(29,161,242,0.12),transparent_45%),radial-gradient(circle_at_50%_92%,rgba(29,161,242,0.10),transparent_52%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(29,161,242,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(29,161,242,0.05)_1px,transparent_1px)] bg-[size:36px_36px]" />
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
        "border border-[#1DA1F2]/15 bg-black/35",
        "shadow-[0_0_0_1px_rgba(29,161,242,0.06),0_0_32px_rgba(29,161,242,0.06)]",
        "backdrop-blur-[2px]",
        "p-4 sm:p-5",
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/5 to-transparent" />
      <header className="relative mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold tracking-wide text-white/85">
          {title}
        </div>
        {right ? <div className="text-xs text-slate-200/50">{right}</div> : null}
      </header>
      <div className="relative">{children}</div>
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
      ? "border-[#1DA1F2]/15 bg-[#1DA1F2]/5 text-[#1DA1F2]/35 cursor-not-allowed"
      : "border-[#1DA1F2]/20 bg-[#1DA1F2]/10 text-[#1DA1F2] hover:bg-[#1DA1F2]/15 focus:ring-[#1DA1F2]/20",
    danger: disabled
      ? "border-rose-500/15 bg-rose-500/5 text-rose-200/35 cursor-not-allowed"
      : "border-rose-500/25 bg-rose-500/10 text-rose-100/85 hover:bg-rose-500/15 focus:ring-rose-500/20",
    neutral: disabled
      ? "border-white/10 bg-white/5 text-white/35 cursor-not-allowed"
      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 focus:ring-white/10",
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
          ? "border-[#1DA1F2]/25 bg-[#1DA1F2]/12 text-[#1DA1F2]"
          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
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
          ? "border-[#1DA1F2]/20 bg-[#1DA1F2]/10 text-[#1DA1F2]/90"
          : "border-white/10 bg-white/5 text-white/45",
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          ok
            ? "bg-[#1DA1F2] shadow-[0_0_12px_rgba(29,161,242,0.35)]"
            : "bg-white/30",
        ].join(" ")}
      />
      {ok ? "Connected" : "Connecting"}
    </span>
  );
}

// -------------------------------------
// LobbyPage
// -------------------------------------
export default function LobbyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: lobbyId } = useParams();

  const { state, dispatch } = useLobbyContext();
  const { friends = [] } = useFriends();
  const { user } = useUserContext();

  const [message, setMessage] = useState("");
  const [activeMobileTab, setActiveMobileTab] = useState("players"); // "players" | "chat"

  // Modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  // WS refs
  const lobbyWsRef = useRef(null);
  const chatWsRef = useRef(null);

  const [lobbyConnected, setLobbyConnected] = useState(false);
  const [chatConnected, setChatConnected] = useState(false);

  const chatContainerRef = useRef(null);

  const MAX_PLAYERS = 2;
  const players = state?.players || [];
  const messages = state?.messages || [];

  const isLobbyFull = useMemo(() => players.length >= MAX_PLAYERS, [players]);

  const onlineFriends = useMemo(
    () => (friends || []).filter((f) => f?.friend_status === "online"),
    [friends]
  );

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

  // # Step 2: Session key helpers
  const getStoredSessionKey = useCallback(() => {
    if (!lobbyId) return null;
    return sessionStorage.getItem(`sessionKey:${lobbyId}`) || null;
  }, [lobbyId]);

  const setStoredSessionKey = useCallback((id, key) => {
    if (!id || !key) return;
    sessionStorage.setItem(`sessionKey:${String(id)}`, String(key));
  }, []);

  const buildGameUrl = useCallback(
    ({ gameId, sessionKey }) => {
      const params = new URLSearchParams();
      if (sessionKey) params.set("sessionKey", String(sessionKey));
      if (lobbyId) params.set("lobbyId", String(lobbyId));
      const qs = params.toString();
      return qs ? `/games/${gameId}?${qs}` : `/games/${gameId}`;
    },
    [lobbyId]
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
        const storedSessionKey = sessionStorage.getItem(`sessionKey:${lobbyId}`);

        const sessionKey = sessionKeyFromUrl || storedSessionKey || null;

        const lobbyUrl = getLobbyWSUrl({
          lobbyId,
          token: access,
          inviteId,
          sessionKey,
        });

        const chatUrl = getChatWSUrl({ lobbyId, token: access });

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

              navigate(`/lobby/${nextLobbyId}?${next.toString()}`, {
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
  }, [lobbyId]);

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
      `${window.location.origin}/lobby/${lobbyId}?${params.toString()}`
    );
    showToast("success", "Link copied.");
  }, [getStoredSessionKey, lobbyId, location.search]);

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
          gameType: "tic_tac_toe",
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
    [lobbyId, user?.id]
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
    if (!isLobbyFull) {
      showToast("error", "Need 2 players to start.");
      return;
    }

    const ws = lobbyWsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showToast("error", "Lobby not connected yet.");
      return;
    }

    ws.send(JSON.stringify({ type: "start_game" }));
  }, [isLobbyFull]);

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
            <div className="text-[11px] uppercase tracking-[0.22em] text-[#1DA1F2]/60">
              Lobby • Tic-Tac-Toe
            </div>

            <div className="mt-1 flex items-baseline gap-2">
              <h1 className="text-lg sm:text-xl font-semibold text-white/85">
                Lobby {lobbyId}
              </h1>
              <span className="hidden sm:inline text-xs text-slate-200/45">
                Online friends: {onlineFriends.length}
              </span>
            </div>

            {/* Mobile: status compact */}
            <div className="mt-3 flex flex-wrap items-center gap-2 lg:hidden">
              <StatusDot ok={lobbyConnected} />
              <StatusDot ok={chatConnected} />
              <span className="text-[11px] text-slate-200/40">
                Online: {onlineFriends.length}
              </span>
            </div>

            {/* Desktop: richer info */}
            <div className="mt-3 hidden lg:flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#1DA1F2]/20 bg-[#1DA1F2]/10 px-2.5 py-1 text-[11px] text-[#1DA1F2]/90">
                Lobby WS: {lobbyConnected ? "LIVE" : "CONNECTING"}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#1DA1F2]/20 bg-[#1DA1F2]/10 px-2.5 py-1 text-[11px] text-[#1DA1F2]/90">
                Chat WS: {chatConnected ? "LIVE" : "CONNECTING"}
              </span>
              <span className="text-[11px] text-slate-200/40">
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
          <div className="flex-1 flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
            <SegTab
              active={activeMobileTab === "players"}
              onClick={() => setActiveMobileTab("players")}
              label={`Players (${players.length}/2)`}
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
            <Panel title="Players" right={`${players.length}/2`}>
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, idx) => {
                  const p = players[idx];

                  if (!p) {
                    return (
                      <button
                        key={`slot-${idx}`}
                        type="button"
                        onClick={() => setIsInviteOpen(true)}
                        className={[
                          "group w-full text-left rounded-2xl",
                          "border border-dashed border-[#1DA1F2]/20 bg-black/20",
                          "px-4 py-4 transition",
                          "hover:border-[#1DA1F2]/30 hover:bg-black/25",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#1DA1F2]/15 bg-[#1DA1F2]/5">
                            <CiCirclePlus className="text-xl text-[#1DA1F2]/80 group-hover:text-[#1DA1F2]" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-200/45">
                              Slot {idx + 1}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-white/80">
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
                      className="rounded-2xl border border-[#1DA1F2]/12 bg-black/20 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-200/45">
                            Player {idx + 1}
                          </div>
                          <div className="mt-1 truncate text-sm font-semibold text-white/85">
                            {p.first_name || "Player"}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-200/40">
                            Connected
                          </div>
                        </div>
                        <div className="mt-1 h-2 w-2 rounded-full bg-[#1DA1F2] shadow-[0_0_12px_rgba(29,161,242,0.35)]" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop extra controls inside panel */}
              <div className="mt-4 hidden lg:flex gap-2">
                <HudButton
                  onClick={handleStartGame}
                  disabled={!isLobbyFull}
                  className="flex-1"
                >
                  Start Game
                </HudButton>
                <HudButton onClick={handleLeaveLobby} variant="neutral">
                  Exit
                </HudButton>
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
            >
              <div className="flex flex-col gap-3">
                <div
                  ref={chatContainerRef}
                  className={[
                    "overflow-y-auto rounded-2xl border border-[#1DA1F2]/10 bg-black/20 p-3 space-y-2 tron-scrollbar-dark",
                    // ✅ Mobile: much smaller, not a giant feed
                    "h-[28dvh] min-h-[180px] max-h-[260px]",
                    // ✅ Desktop: can be larger
                    "lg:h-[440px] lg:max-h-none",
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
                                ? "border-[#1DA1F2]/20 bg-[#1DA1F2]/10 text-slate-100/90"
                                : "border-white/10 bg-black/25 text-slate-100/90",
                            ].join(" ")}
                          >
                            <div
                              className={[
                                "text-[11px]",
                                isMe ? "text-[#1DA1F2]/85" : "text-slate-200/55",
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
                    <div className="text-xs text-slate-200/50">
                      No messages yet.
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 rounded-2xl border border-[#1DA1F2]/20 bg-black/40 px-3 py-2">
                    <input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                      placeholder={chatConnected ? "Type a message…" : "Connecting…"}
                      className="
                        flex-1 bg-transparent outline-none
                        text-sm text-slate-100
                        placeholder:text-slate-200/40
                      "
                    />

                    <button
                      type="button"
                      onClick={handleSendChat}
                      disabled={!message.trim() || !chatConnected}
                      className={[
                        "h-9 w-9 grid place-items-center rounded-xl border transition",
                        "border-[#1DA1F2]/20 bg-[#1DA1F2]/10 text-[#1DA1F2]",
                        !message.trim() || !chatConnected
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-[#1DA1F2]/15",
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
            rounded-2xl border border-[#1DA1F2]/15 bg-black/65 backdrop-blur
            shadow-[0_0_26px_rgba(29,161,242,0.10)]
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
            disabled={!isLobbyFull}
            className="flex-1"
            variant="primary"
            title={!isLobbyFull ? "Need 2 players" : "Start the match"}
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

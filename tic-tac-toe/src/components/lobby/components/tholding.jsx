// # Filename: src/components/lobby/LobbyPage.jsx
// Step 1: LobbyPage is the ONLY owner of lobby + chat WebSockets for /lobby/:id.
// Step 2: Lobby route opens Lobby WS + Chat WS (NOT Game WS).
// Step 3: On session_established, promote invite -> sessionKey (sessionStorage + replace URL).
// Step 4: Defense-in-depth: dedupe chat messages by message.id (handler + reducer).
// Step 5: Clean unmount: close sockets and reset lobby state (no reconnect loops).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CiCirclePlus } from "react-icons/ci";
import { IoIosSend } from "react-icons/io";

import { useLobbyContext } from "../../../context/lobbyContext"
import { useFriends } from "../../../context/friendsContext";
import { useUserContext } from "../../../context/userContext";

import { showToast } from "../../../utils/toast/Toast";
import { ensureFreshAccessToken } from "../../../auth/ensureFreshAccessToken";

// Step 0: Canonical WS URL helpers (single source of truth)
import { getLobbyWSUrl, getChatWSUrl } from "../../../websocket/getWebsocketURL";

import { createInvite } from "../../../api/inviteApi";
import { resolveRecipientUserId } from "../../../invites/resolveRecipientUserId";

import InviteFriendModal from "./InviteFriendModal"

// -----------------------------
// UI helpers
// -----------------------------
function Panel({ title, right, children }) {
  return (
    <section
      className={[
        "relative overflow-hidden rounded-2xl",
        "border border-[#1DA1F2]/15 bg-black/35",
        "shadow-[0_0_0_1px_rgba(29,161,242,0.06),0_0_32px_rgba(29,161,242,0.06)]",
        "backdrop-blur-[2px]",
        "p-4 sm:p-5",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/5 to-transparent" />
      <header className="relative mb-4 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold tracking-wide text-cyan-50/90">
          {title}
        </div>
        {right ? <div className="text-xs text-cyan-200/60">{right}</div> : null}
      </header>
      <div className="relative">{children}</div>
    </section>
  );
}

function HudButton({
  children,
  onClick,
  variant = "cyan",
  disabled = false,
  className = "",
}) {
  const base =
    "rounded-lg px-3 py-2 text-xs font-medium transition border focus:outline-none focus:ring-2";
  const styles = {
    cyan: disabled
      ? "border-[#1DA1F2]/15 bg-[#1DA1F2]/5 text-cyan-200/40 cursor-not-allowed"
      : "border-[#1DA1F2]/20 bg-[#1DA1F2]/10 text-cyan-50/85 active:bg-[#1DA1F2]/15 sm:hover:bg-[#1DA1F2]/15 focus:ring-[#1DA1F2]/20",
    rose: disabled
      ? "border-rose-500/15 bg-rose-500/5 text-rose-200/40 cursor-not-allowed"
      : "border-rose-500/25 bg-rose-500/10 text-rose-50/85 active:bg-rose-500/15 sm:hover:bg-rose-500/15 focus:ring-rose-500/20",
    neutral: disabled
      ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
      : "border-white/10 bg-white/5 text-white/70 active:bg-white/10 sm:hover:bg-white/10 focus:ring-white/10",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[base, styles[variant] || styles.cyan, className].join(" ")}
    >
      {children}
    </button>
  );
}

// -----------------------------
// LobbyPage
// -----------------------------
export default function LobbyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: lobbyId } = useParams();

  const { state, dispatch } = useLobbyContext();
  const { friends = [] } = useFriends();
  const { user } = useUserContext();

  const [message, setMessage] = useState("");

  // Step 1: Mobile-first modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  // Step 2: WS refs (single owner)
  const lobbyWsRef = useRef(null);
  const chatWsRef = useRef(null);

  // Step 3: StrictMode safety (avoid double-connect)
  const didConnectRef = useRef(false);

  // Step 4: UI refs
  const chatContainerRef = useRef(null);

  const MAX_PLAYERS = 2;

  const players = state?.players || [];

  const isLobbyFull = useMemo(() => players.length >= MAX_PLAYERS, [players]);

  // Step 5: Only online friends are eligible
  const onlineFriends = useMemo(
    () => (friends || []).filter((f) => f?.friend_status === "online"),
    [friends]
  );

  // -----------------------------
  // Helpers
  // -----------------------------
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

  // -----------------------------
  // WS lifecycle
  // -----------------------------
  useEffect(() => {
    // Step 1: Guard against duplicate connect in StrictMode
    if (didConnectRef.current) return;
    didConnectRef.current = true;

    let cancelled = false;

    const boot = async () => {
      try {
        if (!lobbyId) return;

        // Step 2: Ensure token is fresh BEFORE connecting
        const access = await ensureFreshAccessToken();
        if (!access || cancelled) return;

        // Step 3: Parse URL params
        const params = new URLSearchParams(location.search);
        const inviteId = params.get("invite");
        const sessionKeyFromUrl = params.get("sessionKey");

        // Step 4: Session key storage fallback
        const storedSessionKey = sessionStorage.getItem(`sessionKey:${lobbyId}`);
        const sessionKey = sessionKeyFromUrl || storedSessionKey || null;

        // Step 5: Build URLs (authoritative helpers)
        const lobbyUrl = getLobbyWSUrl({
          lobbyId,
          token: access,
          inviteId,
          sessionKey,
        });
        const chatUrl = getChatWSUrl({ lobbyId, token: access });

        // Step 6: Connect Lobby WS
        const lobbyWs = new WebSocket(lobbyUrl);
        lobbyWsRef.current = lobbyWs;

        lobbyWs.onopen = () => {
          if (cancelled) return;
          // join is server-side implicit in many setups, but keep safe:
          try {
            lobbyWs.send(JSON.stringify({ type: "join_lobby" }));
          } catch {
            // ignore
          }
        };

        lobbyWs.onmessage = (evt) => {
          if (cancelled) return;

          let data;
          try {
            data = JSON.parse(evt.data);
          } catch {
            return;
          }

          // Step 7: Promote invite -> sessionKey
          if (data?.type === "session_established") {
            const nextLobbyId = String(data?.lobbyId ?? lobbyId);
            const nextSessionKey = data?.sessionKey;

            if (nextLobbyId && nextSessionKey) {
              sessionStorage.setItem(
                `sessionKey:${nextLobbyId}`,
                String(nextSessionKey)
              );

              // Replace URL: ?invite=... -> ?sessionKey=...
              const next = new URLSearchParams(location.search);
              next.delete("invite");
              next.set("sessionKey", String(nextSessionKey));

              navigate(`/lobby/${nextLobbyId}?${next.toString()}`, {
                replace: true,
              });
            }
          }

          // Step 8: Lobby reducer events
          if (data?.type === "update_player_list") {
            dispatch({ type: "SET_PLAYERS", payload: data?.players || [] });
          }

          if (data?.type === "game_start_acknowledgment") {
            const gameId = data?.game_id || data?.gameId;
            if (gameId) {
              navigate(`/games/${gameId}`, { replace: true });
            }
          }

          if (data?.type === "error") {
            showToast("error", data?.message || "Lobby error.");
          }
        };

        lobbyWs.onerror = () => {
          if (cancelled) return;
          // Avoid spamming errors; keep it quiet unless needed
        };

        // Step 9: Connect Chat WS
        const chatWs = new WebSocket(chatUrl);
        chatWsRef.current = chatWs;

        chatWs.onmessage = (evt) => {
          if (cancelled) return;

          let data;
          try {
            data = JSON.parse(evt.data);
          } catch {
            return;
          }

          if (data?.type === "chat_message") {
            // Defense-in-depth: reducer also dedupes by message.id
            dispatch({ type: "CHAT_MESSAGE_RECEIVED", payload: data?.message });
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
      dispatch({ type: "RESET_LOBBY" });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyId]);

  // -----------------------------
  // Auto-scroll chat
  // -----------------------------
  useEffect(() => {
    if (!chatContainerRef.current) return;
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [state?.messages]);

  // -----------------------------
  // Actions
  // -----------------------------
  const handleCopyLink = useCallback(() => {
    // Step 1: Copies the *current URL* (invite OR sessionKey)
    navigator.clipboard.writeText(
      `${window.location.origin}/lobby/${lobbyId}${location.search}`
    );
    showToast("success", "Link copied.");
  }, [lobbyId, location.search]);

  const handleOpenInvite = useCallback(() => {
    setIsInviteOpen(true);
  }, []);

  const handleInviteFriend = useCallback(
    async (friend) => {
      try {
        // Step 1: Basic guards
        if (!user?.id || !lobbyId) return;

        const recipientUserId = resolveRecipientUserId(friend, user.id);
        if (!recipientUserId) return;
        if (Number(recipientUserId) === Number(user.id)) return;

        setIsInviting(true);

        // Step 2: Create invite INTO THIS LOBBY (no navigation)
        const result = await createInvite({
          toUserId: recipientUserId,
          gameType: "tic_tac_toe",
          lobbyId,
        });

        // Step 3: Normalize response (handle mild backend drift)
        const inviteId =
          result?.invite?.inviteId ||
          result?.invite?.id ||
          result?.inviteId ||
          result?.invite_id;

        if (!inviteId) {
          console.error(
            "[Lobby Invite] Missing inviteId from createInvite response:",
            result
          );
          showToast("error", "Invite failed (missing inviteId).");
          return;
        }

        showToast("success", "Invite sent!");
        setIsInviteOpen(false);
      } catch (error) {
        console.error("Lobby invite: Failed to create invite:", error);
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

  // -----------------------------
  // Render
  // -----------------------------
  const messages = state?.messages || [];

  return (
    <div className="w-full h-full min-h-0 px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
      <div className="mx-auto max-w-[1100px] space-y-4">
        {/* Header (mobile-first stack) */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/45">
              Multiplayer
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <h1 className="text-lg sm:text-xl font-semibold text-cyan-50/90">
                Lobby
              </h1>
              <span className="text-xs text-cyan-200/50">ID: {lobbyId}</span>
            </div>
            <div className="mt-1 text-[11px] text-cyan-200/35">
              Online friends available: {onlineFriends.length}
            </div>
          </div>

          {/* Actions (mobile: full-width buttons) */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
            <HudButton onClick={handleOpenInvite} variant="cyan">
              Invite Friend
            </HudButton>
            <HudButton onClick={handleCopyLink} variant="neutral">
              Copy Link
            </HudButton>
            <HudButton onClick={handleLeaveLobby} variant="rose">
              Leave
            </HudButton>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Players */}
          <div className="lg:col-span-5 space-y-4">
            <Panel
              title="Players"
              right={`${players.length}/${MAX_PLAYERS}`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                {Array.from({ length: MAX_PLAYERS }).map((_, idx) => {
                  const p = players[idx];

                  if (!p) {
                    return (
                      <button
                        key={`slot-${idx}`}
                        type="button"
                        onClick={handleOpenInvite}
                        className={[
                          "group relative rounded-xl border border-dashed border-[#1DA1F2]/20 bg-black/20",
                          "px-4 py-4 text-left transition",
                          "active:border-[#1DA1F2]/30 active:bg-black/25 sm:hover:border-[#1DA1F2]/30 sm:hover:bg-black/25",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-lg border border-[#1DA1F2]/15 bg-[#1DA1F2]/5">
                            <CiCirclePlus className="text-xl text-cyan-200/70 group-hover:text-cyan-100/90" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/45">
                              Slot {idx + 1}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-cyan-50/80">
                              Invite player
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 text-[11px] text-cyan-200/40">
                          Invite an online friend to fill this slot.
                        </div>
                      </button>
                    );
                  }

                  return (
                    <div
                      key={String(p.id)}
                      className="relative rounded-xl border border-[#1DA1F2]/12 bg-black/20 px-4 py-4"
                    >
                      <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/45">
                        Player {idx + 1}
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold text-cyan-50/90">
                        {p.first_name || "Player"}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-[11px] text-cyan-200/45">
                          Connected
                        </div>
                        <div className="h-2 w-2 rounded-full bg-cyan-300/70 shadow-[0_0_12px_rgba(34,211,238,0.35)]" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile-first stacked actions */}
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <HudButton
                  onClick={handleStartGame}
                  disabled={!isLobbyFull}
                  className="w-full sm:flex-1"
                >
                  Start Game
                </HudButton>
                <HudButton
                  onClick={handleLeaveLobby}
                  variant="neutral"
                  className="w-full sm:w-auto"
                >
                  Exit
                </HudButton>
              </div>
            </Panel>
          </div>

          {/* Chat */}
          <div className="lg:col-span-7">
            <Panel title="Lobby Chat" right="Chat WS">
              <div className="flex flex-col gap-3">
                <div
                  ref={chatContainerRef}
                  className={[
                    "overflow-y-auto rounded-xl border border-[#1DA1F2]/10 bg-black/20 p-3 space-y-2",
                    // Mobile-first: height based on viewport
                    "h-[42vh] sm:h-[360px] lg:h-[420px]",
                  ].join(" ")}
                >
                  {messages.length ? (
                    messages.map((m, idx) => {
                      const id = m?.id ? String(m.id) : null;
                      const sender = m?.sender || "User";
                      const content = m?.content || "";

                      return (
                        <div
                          key={id || `${sender}|${content}|${idx}`}
                          className="rounded-lg border border-[#1DA1F2]/10 bg-black/20 px-3 py-2 text-sm text-cyan-50/90"
                        >
                          <span className="text-cyan-200/60">{sender}:</span>{" "}
                          <span className="text-cyan-50/90">{content}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-cyan-200/45">
                      No messages yet.
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                    placeholder="Type a message..."
                    className="flex-1 rounded-lg border border-[#1DA1F2]/15 bg-black/20 px-3 py-2 text-sm text-cyan-50 placeholder:text-cyan-200/35 focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/15"
                  />

                  <button
                    type="button"
                    onClick={handleSendChat}
                    disabled={!message.trim()}
                    className={[
                      "inline-flex items-center justify-center rounded-lg px-3 py-2",
                      "border border-[#1DA1F2]/20",
                      message.trim()
                        ? "bg-[#1DA1F2]/10 text-cyan-50/90 active:bg-[#1DA1F2]/15 sm:hover:bg-[#1DA1F2]/15"
                        : "cursor-not-allowed bg-[#1DA1F2]/5 text-cyan-200/40",
                    ].join(" ")}
                  >
                    <IoIosSend size={18} />
                  </button>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {/* Invite modal */}
      <InviteFriendModal
        open={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        friends={onlineFriends}
        onInvite={handleInviteFriend}
        lobbyId={lobbyId}
        isInviting={isInviting}
      />
    </div>
  );
}

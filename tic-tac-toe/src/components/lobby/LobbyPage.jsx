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

import { useLobbyContext } from "../context/lobbyContext";
import { showToast } from "../../utils/toast/Toast";
import { ensureFreshAccessToken } from "../auth/ensureFreshAccessToken";

// Step 0: Canonical WS URL helpers (single source of truth)
import { getLobbyWSUrl, getChatWSUrl } from "../websocket/getWebsocketURL"

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
        "p-4 md:p-5",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/5 to-transparent" />
      <header className="relative mb-4 flex items-center justify-between">
        <div className="text-sm font-semibold tracking-wide text-cyan-50/90">{title}</div>
        {right ? <div className="text-xs text-cyan-200/60">{right}</div> : null}
      </header>
      <div className="relative">{children}</div>
    </section>
  );
}

function HudButton({ children, onClick, variant = "cyan", disabled = false, className = "" }) {
  const base =
    "rounded-lg px-3 py-2 text-xs font-medium transition border focus:outline-none focus:ring-2";
  const styles = {
    cyan: disabled
      ? "border-[#1DA1F2]/15 bg-[#1DA1F2]/5 text-cyan-200/40 cursor-not-allowed"
      : "border-[#1DA1F2]/20 bg-[#1DA1F2]/10 text-cyan-50/85 hover:bg-[#1DA1F2]/15 focus:ring-[#1DA1F2]/20",
    rose: disabled
      ? "border-rose-500/15 bg-rose-500/5 text-rose-200/40 cursor-not-allowed"
      : "border-rose-500/25 bg-rose-500/10 text-rose-50/80 hover:bg-rose-500/15 focus:ring-rose-500/20",
    neutral: disabled
      ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
      : "border-white/12 bg-white/8 text-white/80 hover:bg-white/10 focus:ring-white/10",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[base, styles[variant], className].join(" ")}
    >
      {children}
    </button>
  );
}

function safeClose(ws) {
  if (!ws) return;
  try {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    ws.close(1000, "client closing");
  } catch {
    // ignore
  }
}

// -----------------------------
// Component
// -----------------------------
export default function LobbyPage() {
  const { id: lobbyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, dispatch } = useLobbyContext();

  const [message, setMessage] = useState("");
  const chatContainerRef = useRef(null);

  // Step 1: Track sockets + urls (prevents duplicate connections)
  const lobbyWsRef = useRef(null);
  const lobbyUrlRef = useRef(null);

  const chatWsRef = useRef(null);
  const chatUrlRef = useRef(null);

  // Step 2: StrictMode/async guard
  const connectSeqRef = useRef(0);

  // Step 3: Optional handler-level dedupe (reducer also dedupes by id)
  const seenChatIdsRef = useRef(new Set());

  const MAX_PLAYERS = 2;
  const players = state?.players || [];
  const isLobbyFull = players.length >= MAX_PLAYERS;

  // Step 4: URL params
  const inviteId = useMemo(() => new URLSearchParams(location.search).get("invite"), [location.search]);
  const sessionKeyFromUrl = useMemo(
    () => new URLSearchParams(location.search).get("sessionKey"),
    [location.search]
  );

  const storedSessionKey = useMemo(() => {
    try {
      return sessionStorage.getItem(`sessionKey:${lobbyId}`);
    } catch {
      return null;
    }
  }, [lobbyId]);

  const effectiveSessionKey = sessionKeyFromUrl || storedSessionKey;

  // Step 5: Promote sessionKey into URL + sessionStorage
  const promoteSessionKey = useCallback(
    (nextSessionKey) => {
      if (!nextSessionKey) return;

      try {
        sessionStorage.setItem(`sessionKey:${lobbyId}`, String(nextSessionKey));
      } catch {
        // ignore
      }

      const params = new URLSearchParams(location.search);
      params.delete("invite");
      params.set("sessionKey", String(nextSessionKey));

      navigate(`/lobby/${lobbyId}?${params.toString()}`, { replace: true });
    },
    [lobbyId, location.search, navigate]
  );

  // Step 6: Connect Lobby WS + Chat WS (single effect, single token fetch)
  useEffect(() => {
    let cancelled = false;
    const seq = ++connectSeqRef.current;

    const run = async () => {
      // Step 6.1: Guard access context (invite OR sessionKey)
      if (!inviteId && !effectiveSessionKey) {
        showToast("error", "Missing invite/session. Re-enter from Home or an Invite link.");
        navigate("/", { replace: true });
        return;
      }

      // Step 6.2: Ensure a fresh access token BEFORE connecting sockets
      const token = await ensureFreshAccessToken({ minTtlSeconds: 60 });
      if (cancelled || seq !== connectSeqRef.current) return;

      // Guests mount zero sockets (route is protected, but guard anyway)
      if (!token) {
        showToast("error", "You must be logged in to join the lobby.");
        navigate("/login", { replace: true });
        return;
      }

      // Step 6.3: Build URLs
      const lobbyWsUrl = getLobbyWSUrl({
        lobbyId,
        token,
        inviteId: inviteId || null,
        sessionKey: inviteId ? null : effectiveSessionKey || null,
      });

      const chatWsUrl = getChatWSUrl({ lobbyId, token });

      // ----------------------------
      // Lobby WS connect
      // ----------------------------
      if (
        lobbyWsRef.current &&
        lobbyUrlRef.current === lobbyWsUrl &&
        (lobbyWsRef.current.readyState === WebSocket.CONNECTING ||
          lobbyWsRef.current.readyState === WebSocket.OPEN)
      ) {
        // already connected to correct URL
      } else {
        safeClose(lobbyWsRef.current);

        const ws = new WebSocket(lobbyWsUrl);
        lobbyWsRef.current = ws;
        lobbyUrlRef.current = lobbyWsUrl;

        ws.onmessage = (event) => {
          let data;
          try {
            data = JSON.parse(event.data);
          } catch {
            return;
          }

          if (data.type === "session_established") {
            if (data.sessionKey) promoteSessionKey(data.sessionKey);
            return;
          }

          if (data.type === "update_player_list") {
            dispatch({ type: "PLAYER_LIST", payload: data.players || [] });
            return;
          }

          if (data.type === "game_start_acknowledgment") {
            const stableKey =
              sessionKeyFromUrl ||
              storedSessionKey ||
              data.sessionKey ||
              (effectiveSessionKey || null);

            const params = new URLSearchParams();
            if (stableKey) params.set("sessionKey", String(stableKey));
            params.set("lobby", String(lobbyId));

            navigate(`/games/${data.game_id}?${params.toString()}`);
            return;
          }

          if (data.type === "error") {
            showToast("error", data.message || "Lobby error.");
          }
        };

        ws.onclose = (e) => {
          // Step 6.4: Close-code UX (no reconnect loops here)
          if (cancelled) return;

          if (e?.code === 4408) {
            // invalid session
            try {
              sessionStorage.removeItem(`sessionKey:${lobbyId}`);
            } catch {
              // ignore
            }
            showToast("error", "Session expired. Re-enter lobby from Home or a fresh invite.");
            navigate("/", { replace: true });
            return;
          }

          if (e?.code === 4404) {
            showToast("error", "Invite or sessionKey required.");
            navigate("/", { replace: true });
          }
        };
      }

      // ----------------------------
      // Chat WS connect
      // ----------------------------
      if (
        chatWsRef.current &&
        chatUrlRef.current === chatWsUrl &&
        (chatWsRef.current.readyState === WebSocket.CONNECTING ||
          chatWsRef.current.readyState === WebSocket.OPEN)
      ) {
        // already connected to correct URL
      } else {
        safeClose(chatWsRef.current);

        const ws = new WebSocket(chatWsUrl);
        chatWsRef.current = ws;
        chatUrlRef.current = chatWsUrl;

        ws.onmessage = (event) => {
          let data;
          try {
            data = JSON.parse(event.data);
          } catch {
            return;
          }

          if (data.type === "chat_message") {
            const msg = data.message;

            const msgId = msg?.id ? String(msg.id) : null;
            if (msgId) {
              if (seenChatIdsRef.current.has(msgId)) return;
              seenChatIdsRef.current.add(msgId);
            }

            dispatch({ type: "ADD_MESSAGE", payload: msg });
            return;
          }

          if (data.type === "error") {
            showToast("error", data.message || "Chat error.");
          }
        };
      }
    };

    run();

    return () => {
      cancelled = true;

      // Step 6.5: Cleanup sockets + reset lobby state (prevents stale chat/roster)
      safeClose(lobbyWsRef.current);
      lobbyWsRef.current = null;
      lobbyUrlRef.current = null;

      safeClose(chatWsRef.current);
      chatWsRef.current = null;
      chatUrlRef.current = null;

      dispatch({ type: "RESET_LOBBY" });
    };
  }, [
    lobbyId,
    inviteId,
    effectiveSessionKey,
    navigate,
    dispatch,
    promoteSessionKey,
    sessionKeyFromUrl,
    storedSessionKey,
  ]);

  // Step 7: Auto-scroll chat
  useEffect(() => {
    if (!chatContainerRef.current) return;
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [state?.messages]);

  // -----------------------------
  // Actions
  // -----------------------------
  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(`${window.location.origin}/lobby/${lobbyId}${location.search}`);
    showToast("success", "Invite link copied.");
  }, [lobbyId, location.search]);

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
    <div className="w-full h-full min-h-0 px-3 sm:px-4 md:px-6 py-4 md:py-6">
      <div className="mx-auto max-w-[1100px] space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-200/45">
              Multiplayer
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <h1 className="text-lg md:text-xl font-semibold text-cyan-50/90">Lobby</h1>
              <span className="text-xs text-cyan-200/50">ID: {lobbyId}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <HudButton onClick={handleCopyLink} variant="cyan">
              Copy Invite
            </HudButton>
            <HudButton onClick={handleLeaveLobby} variant="rose">
              Leave
            </HudButton>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-4">
            <Panel title="Players" right={`${players.length}/${MAX_PLAYERS}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                {Array.from({ length: MAX_PLAYERS }).map((_, idx) => {
                  const p = players[idx];

                  if (!p) {
                    return (
                      <button
                        key={`slot-${idx}`}
                        type="button"
                        onClick={handleCopyLink}
                        className={[
                          "group relative rounded-xl border border-dashed border-[#1DA1F2]/20 bg-black/20",
                          "px-4 py-4 text-left hover:border-[#1DA1F2]/30 hover:bg-black/25 transition",
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
                          Copy invite link to fill this slot.
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
                        <div className="text-[11px] text-cyan-200/45">Connected</div>
                        <div className="h-2 w-2 rounded-full bg-cyan-300/70 shadow-[0_0_12px_rgba(34,211,238,0.35)]" />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex gap-2">
                <HudButton onClick={handleStartGame} disabled={!isLobbyFull} className="flex-1">
                  Start Game
                </HudButton>
                <HudButton onClick={handleLeaveLobby} variant="neutral">
                  Exit
                </HudButton>
              </div>
            </Panel>
          </div>

          <div className="lg:col-span-7">
            <Panel title="Lobby Chat" right="Chat WS">
              <div className="flex flex-col gap-3">
                <div
                  ref={chatContainerRef}
                  className="h-[320px] sm:h-[360px] md:h-[420px] overflow-y-auto rounded-xl border border-[#1DA1F2]/10 bg-black/20 p-3 space-y-2"
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
                    <div className="text-xs text-cyan-200/45">No messages yet.</div>
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
                        ? "bg-[#1DA1F2]/10 text-cyan-50/90 hover:bg-[#1DA1F2]/15"
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
    </div>
  );
}

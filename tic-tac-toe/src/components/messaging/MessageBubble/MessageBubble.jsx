// # Filename: src/components/messaging/DMDrawer/MessageBubble.jsx

import React, { useMemo } from "react";
import { Link } from "react-router-dom";

/**
 * MessageBubble (Tron/HUD modern)
 * - Pure Tailwind
 * - Correct left/right alignment:
 *   sender_id (WS/normalized REST) OR sender (raw REST) vs currentUserId
 */
export default function MessageBubble({ msg, currentUserId, showSender = false }) {
  const senderId = msg?.sender_id ?? msg?.sender ?? null;
  const isMine = Number(senderId) === Number(currentUserId);

  const text = useMemo(() => {
    if (msg?.type === "game_invite") return "";
    return String(msg?.content ?? msg?.message ?? "");
  }, [msg]);

  const extractedLink = useMemo(() => {
    const src = String(msg?.content ?? msg?.message ?? "");
    const lobbyMatch = src.match(/\/lobby\/\d+/) || [];
    const gameMatch = src.match(/\/games\/\d+/) || [];
    return lobbyMatch[0] || gameMatch[0] || null;
  }, [msg]);

  if (msg?.type !== "game_invite" && text.trim() === "") return null;

  const timeText = msg?.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const bubbleBase =
    "relative max-w-[82%] sm:max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed " +
    "border backdrop-blur-md overflow-hidden " +
    "shadow-[0_10px_30px_rgba(0,0,0,0.35)]";

  // Subtle “scanline / highlight” overlay
  const overlayBase =
    "pointer-events-none absolute inset-0 opacity-[0.85]";

  // Accent glow ring (mine stronger)
  const glowMine =
    "shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_22px_rgba(34,211,238,0.18)]";
  const glowTheirs =
    "shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_18px_rgba(34,211,238,0.08)]";

  const mine =
    "bg-background-app-panel/80 border-brand-cyan/25 text-text-primary " + glowMine;

  const theirs =
    "bg-surface border-border-soft text-text-primary " + glowTheirs;

  // A thin neon edge strip
  const edgeMine = "bg-brand-cyan/35";
  const edgeTheirs = "bg-white/10";

  const linkClass =
    "inline-flex items-center gap-2 text-brand-cyan hover:text-brand-cyan-300 " +
    "underline underline-offset-4";

  return (
    <div className={`mb-3 flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div className={[bubbleBase, isMine ? mine : theirs].join(" ")}>
        {/* Step 1: Neon edge strip */}
        <div
          className={[
            "absolute left-0 top-0 h-full w-[2px]",
            isMine ? edgeMine : edgeTheirs,
          ].join(" ")}
        />

        {/* Step 2: Soft top highlight + faint scanline */}
        <div className={overlayBase}>
          <div className="absolute inset-x-0 top-0 h-[1px] bg-white/10" />
          <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/8 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.10),transparent_45%)]" />
        </div>

        {/* Step 3: Content */}
        <div className="relative">
          {showSender && !isMine && msg?.sender_name ? (
            <div className="mb-1 text-[11px] font-semibold text-brand-cyan/80 truncate">
              {msg.sender_name}
            </div>
          ) : null}

          {msg?.type === "game_invite" && msg?.lobby_id ? (
            <Link to={`/lobby/${msg.lobby_id}`} className={linkClass}>
              <span className="inline-block rounded-full px-2 py-[2px] border border-brand-cyan/25 bg-brand-cyan/10 text-[12px]">
                Invite
              </span>
              Join Lobby →
            </Link>
          ) : extractedLink ? (
            <Link to={extractedLink} className={linkClass}>
              <span className="inline-block rounded-full px-2 py-[2px] border border-brand-cyan/25 bg-brand-cyan/10 text-[12px]">
                Link
              </span>
              {extractedLink.includes("/lobby/") ? "Join Lobby →" : "Accept Challenge →"}
            </Link>
          ) : (
            <div className="whitespace-pre-wrap break-words">{text}</div>
          )}

          {/* Step 4: Timestamp chip */}
          {!!timeText && (
            <div className="mt-2 flex justify-end">
              <span
                className={[
                  "text-[11px] px-2 py-[2px] rounded-full border",
                  isMine
                    ? "border-brand-cyan/20 bg-brand-cyan/10 text-text-secondary"
                    : "border-white/10 bg-white/5 text-text-secondary",
                ].join(" ")}
              >
                {timeText}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

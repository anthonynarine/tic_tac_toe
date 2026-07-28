// # Filename: src/components/friends/FriendRow.jsx

import React, { useMemo, useState } from "react";
import { PiGameController } from "react-icons/pi";
import { CiChat1 } from "react-icons/ci";

const INVITE_GAME_OPTIONS = [
  { gameType: "tic_tac_toe", label: "Tic-Tac-Toe" },
  { gameType: "connect_four", label: "Connect Four" },
];

/**
 * FriendRow
 * ---------
 * Step 1: Keeps current functionality:
 * - Chat bubble calls onClick(friend) (your handler should open drawer + openChat(friend))
 * - Game icon calls onInvite(friend)
 *
 * Step 2: Optional per-friend unread indicator:
 * - Shows a tiny dot when unreadCount >= 1 (does not display a number here unless you want it)
 * - The panel already has the aggregate "New N" pill.
 */
export default function FriendRow({ friend, user, onClick, onInvite, unreadCount = 0 }) {
  const isOnline = friend?.friend_status === "online";
  const [isGamePickerOpen, setIsGamePickerOpen] = useState(false);

  // Step 1: resolve friend user id (useful for debugging/future)
  const friendUserId = useMemo(() => {
    const isCurrentUserSender = Number(friend?.from_user) === Number(user?.id);
    return isCurrentUserSender ? friend?.to_user : friend?.from_user;
  }, [friend, user]);

  return (
    <li>
      <div
        className={[
          "w-full flex items-center gap-3 p-3.5 rounded-xl border",
          "bg-transparent border-border-soft",
          "transition-colors duration-200",
          isOnline ? "hover:bg-surface hover:border-border" : "opacity-40",
        ].join(" ")}
      >
        {/* Step 2: Main clickable area (optional: also opens chat) */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span
            className={[
              "h-2.5 w-2.5 rounded-full shrink-0",
              isOnline ? "bg-brand-emerald shadow-glow-emerald" : "bg-text-faint/40",
            ].join(" ")}
            aria-hidden="true"
          />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {friend?.friend_name || "Friend"}
            </p>
            <p className={["text-xs", isOnline ? "text-brand-emerald" : "text-text-faint"].join(" ")}>
              {isOnline ? "Online" : "Offline"}
            </p>
          </div>

          {/* Step 3: Per-friend unread indicator (dot only) */}
          {unreadCount >= 1 ? (
            <span
              className="h-2 w-2 rounded-full bg-brand-cyan shadow-glow-cyan"
              aria-label="New message"
              title="New message"
            />
          ) : null}
        </div>

        {/* Step 4: Action icons (keeps your current behavior) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!isOnline) return;
              onClick(friend);
            }}
            disabled={!isOnline}
            className={[
              "h-9 w-9 grid place-items-center rounded-lg",
              "text-text-muted hover:text-brand-cyan hover:bg-brand-cyan/10",
              "focus:outline-none",
              !isOnline ? "cursor-not-allowed opacity-40" : "",
            ].join(" ")}
            title="Chat"
            aria-label="Chat"
          >
            <CiChat1 size={20} />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!isOnline) return;
                setIsGamePickerOpen((v) => !v);
              }}
              disabled={!isOnline}
              className={[
                "h-9 w-9 grid place-items-center rounded-lg",
                "text-text-muted hover:text-brand-cyan hover:bg-brand-cyan/10",
                "focus:outline-none",
                !isOnline ? "cursor-not-allowed opacity-40" : "",
              ].join(" ")}
              title="Invite to Game"
              aria-label="Invite to game"
            >
              <PiGameController size={18} />
            </button>

            {isGamePickerOpen && (
              <ul className="absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border border-border-soft bg-background-app-panel shadow-glow-cyan overflow-hidden">
                {INVITE_GAME_OPTIONS.map(({ gameType, label }) => (
                  <li key={gameType}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsGamePickerOpen(false);
                        onInvite(friend, gameType);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-text-secondary hover:bg-brand-cyan/10 hover:text-brand-cyan transition-colors"
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* keep for future debugging/hooks */}
          <span className="sr-only">{friendUserId}</span>
        </div>
      </div>
    </li>
  );
}

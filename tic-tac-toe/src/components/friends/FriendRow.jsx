// # Filename: src/components/friends/FriendRow.jsx

import React, { useMemo } from "react";
import { PiGameController } from "react-icons/pi";
import { CiChat1 } from "react-icons/ci";

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
          "border-slate-700/40 bg-slate-900/30",
          "transition-colors duration-200",
          isOnline ? "hover:bg-slate-900/45 hover:border-slate-600/50" : "opacity-50",
        ].join(" ")}
      >
        {/* Step 2: Main clickable area (optional: also opens chat) */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span
            className={[
              "h-2.5 w-2.5 rounded-full shrink-0",
              isOnline
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.18)]"
                : "bg-slate-600",
            ].join(" ")}
            aria-hidden="true"
          />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-100 truncate">
              {friend?.friend_name || "Friend"}
            </p>
            <p className={["text-xs", isOnline ? "text-emerald-300/90" : "text-slate-500"].join(" ")}>
              {isOnline ? "Online" : "Offline"}
            </p>
          </div>

          {/* Step 3: Per-friend unread indicator (dot only) */}
          {unreadCount >= 1 ? (
            <span
              className="h-2 w-2 rounded-full bg-[#1DA1F2] shadow-[0_0_10px_rgba(29,161,242,0.18)]"
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
              "text-[#1DA1F2]/80 hover:text-[#1DA1F2]",
              "hover:bg-[#1DA1F2]/10",
              "focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/35",
              !isOnline ? "cursor-not-allowed opacity-40" : "",
            ].join(" ")}
            title="Chat"
            aria-label="Chat"
          >
            <CiChat1 size={20} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!isOnline) return;
              onInvite(friend);
            }}
            disabled={!isOnline}
            className={[
              "h-9 w-9 grid place-items-center rounded-lg",
              "text-[#1DA1F2]/80 hover:text-[#1DA1F2]",
              "hover:bg-[#1DA1F2]/10",
              "focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/35",
              !isOnline ? "cursor-not-allowed opacity-40" : "",
            ].join(" ")}
            title="Invite to Game"
            aria-label="Invite to game"
          >
            <PiGameController size={18} />
          </button>

          {/* keep for future debugging/hooks */}
          <span className="sr-only">{friendUserId}</span>
        </div>
      </div>
    </li>
  );
}

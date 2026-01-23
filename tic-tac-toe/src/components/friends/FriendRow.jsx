// # Filename: src/components/friends/FriendRow.jsx


import React, { useMemo } from "react";
import { PiGameController } from "react-icons/pi";

/**
 * FriendRow
 * ------------------------------------------------------------
 * Single friend row with:
 * - online dot
 * - greedy text (name + status)
 * - unread indicator dot
 * - invite-to-game icon (online only)
 *
 * NOTE:
 * - unreadCount is passed from parent (avoid grabbing context in each row)
 */
export default function FriendRow({ friend, user, onClick, onInvite, unreadCount = 0 }) {
  const isOnline = friend?.friend_status === "online";

  // Step 1: Resolve the friend's user id (for unread mapping, etc.)
  const friendUserId = useMemo(() => {
    const isCurrentUserSender = Number(friend?.from_user) === Number(user?.id);
    return isCurrentUserSender ? friend?.to_user : friend?.from_user;
  }, [friend, user]);

  return (
    <li>
      <button
        type="button"
        onClick={() => onClick(friend)}
        disabled={!isOnline}
        className={[
          "w-full flex items-center gap-3 p-3.5 rounded-xl border",
          "border-slate-700/40 bg-slate-900/30",
          "transition-colors duration-200",
          isOnline
            ? "hover:bg-slate-900/45 hover:border-slate-600/50"
            : "opacity-50 cursor-not-allowed",
        ].join(" ")}
        title={isOnline ? "Open chat" : "Offline"}
      >
        {/* Step 2: Status dot */}
        <span
          className={[
            "h-2.5 w-2.5 rounded-full shrink-0",
            isOnline
              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.18)]"
              : "bg-slate-600",
          ].join(" ")}
          aria-hidden="true"
        />

        {/* Step 3: Greedy text column */}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-slate-100 truncate">
            {friend?.friend_name || "Friend"}
          </p>
          <p className={["text-xs", isOnline ? "text-emerald-300/90" : "text-slate-500"].join(" ")}>
            {isOnline ? "Online" : "Offline"}
          </p>
        </div>

        {/* Step 4: Right-side indicators/actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Unread dot (quiet but visible) */}
          {unreadCount > 0 && (
            <span
              className="h-2.5 w-2.5 rounded-full bg-[#1DA1F2] shadow-[0_0_10px_rgba(29,161,242,0.25)]"
              aria-label={`${unreadCount} unread messages`}
              title={`${unreadCount} unread messages`}
            />
          )}

          {/* Invite-to-game (online only) */}
          {isOnline && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInvite(friend);
              }}
              className="
                h-9 w-9 grid place-items-center rounded-lg
                text-[#1DA1F2]/80 hover:text-[#1DA1F2]
                hover:bg-[#1DA1F2]/10
                focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/35
              "
              title="Invite to Game"
              aria-label="Invite to game"
            >
              <PiGameController size={18} />
            </button>
          )}
        </div>

        {/* Step 5: friendUserId is computed for correctness (kept for debugging / future use) */}
      </button>
    </li>
  );
}

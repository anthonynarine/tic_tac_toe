// # Filename: src/components/friends/FriendRow.jsx
// ✅ New Code

import React, { useMemo } from "react";
import { PiGameController } from "react-icons/pi";
import { CiChat1 } from "react-icons/ci";

export default function FriendRow({
  friend,
  user,
  onClick,
  onInvite,
  unreadCount = 0,
}) {
  const isOnline = friend?.friend_status === "online";

  // Step 1: Resolve friend user id (kept for correctness / future use)
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
          isOnline
            ? "hover:bg-slate-900/45 hover:border-slate-600/50"
            : "opacity-50",
        ].join(" ")}
      >
        {/* Step 2: Clickable main area (opens chat) */}
        <button
          type="button"
          onClick={() => onClick(friend)}
          className={[
            "flex items-center gap-3 flex-1 min-w-0 text-left",
            isOnline ? "cursor-pointer" : "cursor-not-allowed",
          ].join(" ")}
          disabled={!isOnline}
          title={isOnline ? "Open chat" : "Offline"}
        >
          {/* Status dot */}
          <span
            className={[
              "h-2.5 w-2.5 rounded-full shrink-0",
              isOnline
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.18)]"
                : "bg-slate-600",
            ].join(" ")}
            aria-hidden="true"
          />

          {/* Name + status */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-100 truncate">
              {friend?.friend_name || "Friend"}
            </p>
            <p
              className={[
                "text-xs",
                isOnline ? "text-emerald-300/90" : "text-slate-500",
              ].join(" ")}
            >
              {isOnline ? "Online" : "Offline"}
            </p>
          </div>
        </button>

        {/* Step 3: Right-side HUD actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Unread badge */}
          {unreadCount > 0 && (
            <span
              className="
                min-w-[22px] h-[18px] px-1
                inline-flex items-center justify-center
                rounded-full
                text-[11px] font-bold
                bg-[#1DA1F2]/15 text-[#1DA1F2]
                border border-[#1DA1F2]/35
                shadow-[0_0_10px_rgba(29,161,242,0.14)]
              "
              aria-label={`${unreadCount} unread messages`}
              title={`${unreadCount} unread messages`}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}

          {/* ✅ Chat icon (explicit affordance) */}
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

          {/* Invite-to-game icon (online only) */}
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

          {/* Step 4: keep friendUserId around for future debugging/hooks */}
          <span className="sr-only">{friendUserId}</span>
        </div>
      </div>
    </li>
  );
}

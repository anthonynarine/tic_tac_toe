// # Filename: src/components/friends/FriendsPanel.jsx
// ✅ New Code

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CiCircleChevDown, CiCircleChevUp, CiChat1 } from "react-icons/ci";
import FriendRow from "./FriendRow";
import { useUI } from "../context/uiContext";
import { useDirectMessage } from "../context/directMessageContext";

export default function FriendsPanel({
  friends = [],
  user,
  onFriendClick,
  onInvite,
  unreadCounts = {},
  defaultOpen = false,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const { setDMOpen } = useUI();
  const { activeChat } = useDirectMessage();

  // Step 1: Track whether the user has manually toggled this panel
  const userToggledRef = useRef(false);

  // Step 2: Track previous online count so we can detect a 0 -> >0 transition
  const prevOnlineCountRef = useRef(0);

  // Step 3: Online-only count
  const onlineCount = useMemo(() => {
    return friends.filter((f) => f?.friend_status === "online").length;
  }, [friends]);

  // Step 4: Total unread across all threads (panel badge)
  const totalUnread = useMemo(() => {
    return Object.values(unreadCounts || {}).reduce(
      (sum, n) => sum + Number(n || 0),
      0
    );
  }, [unreadCounts]);

  const handleToggle = useCallback(() => {
    // Step 1: Mark manual intent before toggling
    userToggledRef.current = true;
    setIsOpen((v) => !v);
  }, []);

  // Step 2: Explicit DM affordance (never “mystery opens”)
  const handleOpenDM = useCallback(
    (e) => {
      e.stopPropagation();
      if (!activeChat) return;
      setDMOpen(true);
    },
    [activeChat, setDMOpen]
  );

  // Step 3: Auto-open rules:
  // - Only auto-open when onlineCount becomes > 0 AFTER being 0
  // - Only auto-open if the user has NOT manually toggled this panel
  useEffect(() => {
    const prev = prevOnlineCountRef.current;
    const next = onlineCount;

    const becameNonZero = prev === 0 && next > 0;

    if (becameNonZero && !userToggledRef.current) {
      setIsOpen(true);
    }

    prevOnlineCountRef.current = next;
  }, [onlineCount]);

  const bodyClassName = useMemo(() => {
    const base =
      "transition-all duration-300 ease-out will-change-[max-height,opacity]";
    return isOpen
      ? `${base} max-h-[420px] opacity-100 mt-3`
      : `${base} max-h-0 opacity-0 mt-0 pointer-events-none`;
  }, [isOpen]);

  return (
    <section className="w-full">
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between gap-3 text-left select-none"
        aria-expanded={isOpen}
        aria-controls="friends-panel-body"
      >
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-medium tracking-wide text-[#1DA1F2] truncate">
            Friends
          </h3>

          {/* Panel badge: total unread DMs */}
          {totalUnread > 0 && (
            <span
              className="
                inline-flex items-center justify-center
                px-2.5 py-[1px]
                text-xs font-semibold
                rounded-full
                bg-[#1DA1F2]/12 text-[#1DA1F2]
                border border-[#1DA1F2]/30
                shadow-[0_0_10px_rgba(29,161,242,0.08)]
              "
              aria-label={`${totalUnread} unread messages`}
              title={`${totalUnread} unread messages`}
            >
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}

          {/* Optional: online count badge (kept calm) */}
          {onlineCount > 0 && (
            <span
              className="
                inline-flex items-center justify-center
                px-2.5 py-[1px]
                text-xs font-semibold
                rounded-full
                bg-white/5 text-slate-200/70
                border border-white/10
              "
              aria-label={`${onlineCount} friends online`}
              title={`${onlineCount} friends online`}
            >
              {onlineCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Explicit DM button: opens drawer if there is an active chat */}
          {activeChat && (
            <button
              type="button"
              onClick={handleOpenDM}
              className="
                h-9 w-9 grid place-items-center
                rounded-lg hover:bg-[#1DA1F2]/10
                text-[#1DA1F2]/90 hover:text-[#1DA1F2]
                focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/40
              "
              title="Open DM drawer"
              aria-label="Open DM drawer"
            >
              <CiChat1 size={22} />
            </button>
          )}

          <span
            className="
              h-9 w-9 grid place-items-center
              rounded-lg hover:bg-[#1DA1F2]/10
              text-[#1DA1F2]/90 hover:text-[#1DA1F2]
              focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/40
            "
            aria-hidden="true"
          >
            {isOpen ? <CiCircleChevUp size={26} /> : <CiCircleChevDown size={26} />}
          </span>
        </div>
      </button>

      {/* Body */}
      <div id="friends-panel-body" className={bodyClassName}>
        <div className="max-h-[260px] overflow-y-auto pr-2 tron-scrollbar-dark">
          {friends.length === 0 ? (
            <div className="py-3 text-sm text-slate-400">No friends yet.</div>
          ) : (
            <ul className="space-y-2">
              {friends.map((friend) => {
                const isCurrentUserSender =
                  Number(friend?.from_user) === Number(user?.id);
                const friendUserId = isCurrentUserSender
                  ? friend?.to_user
                  : friend?.from_user;

                const unreadCount = Number(unreadCounts?.[friendUserId] || 0);

                return (
                  <FriendRow
                    key={friend.id}
                    friend={friend}
                    user={user}
                    onClick={onFriendClick}
                    onInvite={onInvite}
                    unreadCount={unreadCount}
                  />
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

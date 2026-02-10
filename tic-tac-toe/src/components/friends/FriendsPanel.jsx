// # Filename: src/components/friends/FriendsPanel.jsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CiCircleChevDown, CiCircleChevUp } from "react-icons/ci";
import FriendRow from "./FriendRow";

/**
 * FriendsPanel
 * ------------
 * Step 1: Shows "Friends List" header + online count pill (>= 1).
 * Step 2: Shows "New N" pill when totalUnread >= 1.
 *         - Clicking "New N" ONLY expands the panel (does NOT open DM drawer).
 *         - This avoids the "drawer opens but no active conversation" connecting hang.
 * Step 3: Rows own actions (chat bubble opens DM thread; game icon creates game).
 */
export default function FriendsPanel({
  friends = [],
  user,
  onFriendClick,
  onInvite,
  unreadCounts = {}, // { [friendUserId]: number }
  defaultOpen = false,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Step 1: Respect user intent (prevents auto-open overriding manual collapse)
  const userToggledRef = useRef(false);
  const prevOnlineCountRef = useRef(0);

  // Step 2: Online friends count
  const onlineCount = useMemo(() => {
    return friends.filter((f) => f?.friend_status === "online").length;
  }, [friends]);

  // Step 3: Total unread across all threads
  const totalUnread = useMemo(() => {
    return Object.values(unreadCounts || {}).reduce((sum, n) => sum + Number(n || 0), 0);
  }, [unreadCounts]);

  const handleToggle = useCallback(() => {
    userToggledRef.current = true;
    setIsOpen((v) => !v);
  }, []);

  // Step 4: Clicking New badge only expands panel (no DM drawer open here)
  const handleShowNewMessages = useCallback((e) => {
    e.stopPropagation();
    userToggledRef.current = true;
    setIsOpen(true);
  }, []);

  // Step 5: Optional auto-open when onlineCount transitions 0 -> >0
  useEffect(() => {
    const prev = prevOnlineCountRef.current;
    const next = onlineCount;

    if (prev === 0 && next > 0 && !userToggledRef.current) {
      setIsOpen(true);
    }

    prevOnlineCountRef.current = next;
  }, [onlineCount]);

  const bodyClassName = useMemo(() => {
    const base = "transition-all duration-300 ease-out will-change-[max-height,opacity]";
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
            Friends List
          </h3>

          {/* Step 1: Online count pill (show if >= 1) */}
          {onlineCount >= 1 ? (
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
              {onlineCount > 99 ? "99+" : onlineCount}
            </span>
          ) : null}

          {/* Step 2: New messages pill (show if >= 1) */}
          {totalUnread >= 1 ? (
            <button
              type="button"
              onClick={handleShowNewMessages}
              className="
                inline-flex items-center justify-center
                px-2.5 py-[1px]
                text-xs font-semibold
                rounded-full
                bg-[#1DA1F2]/10 text-[#1DA1F2]
                border border-[#1DA1F2]/25
                hover:bg-[#1DA1F2]/15
                focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/35
              "
              aria-label={`${totalUnread} new messages`}
              title={`${totalUnread} new messages`}
            >
              {totalUnread > 99 ? "99+" : totalUnread} Unread
            </button>
          ) : null}
        </div>

        {/* Step 3: Expand/collapse chevron only */}
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
      </button>

      {/* Body */}
      <div id="friends-panel-body" className={bodyClassName}>
        <div className="max-h-[260px] overflow-y-auto pr-2 tron-scrollbar-dark">
          {friends.length === 0 ? (
            <div className="py-3 text-sm text-slate-400">No friends yet.</div>
          ) : (
            <ul className="space-y-2">
              {friends.map((friend) => {
                const isCurrentUserSender = Number(friend?.from_user) === Number(user?.id);
                const friendUserId = isCurrentUserSender ? friend?.to_user : friend?.from_user;
                const unreadCount = Number(unreadCounts?.[friendUserId] || 0);

                return (
                  <FriendRow
                    key={friend.id || `${friend?.from_user}-${friend?.to_user}`}
                    friend={friend}
                    user={user}
                    onClick={onFriendClick}
                    onInvite={onInvite}
                    unreadCount={unreadCount} // row can show per-friend indicator if you want
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


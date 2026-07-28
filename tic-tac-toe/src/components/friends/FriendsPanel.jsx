// # Filename: src/components/friends/FriendsPanel.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CiCircleChevDown, CiCircleChevUp } from "react-icons/ci";
import { LuUsers } from "react-icons/lu";
import FriendRow from "./FriendRow";
import Badge from "../ui/Badge";

export default function FriendsPanel({
  friends = [],
  user,
  onFriendClick,
  onInvite,
  unreadCounts = {},
  defaultOpen = false,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const userToggledRef = useRef(false);
  const prevOnlineCountRef = useRef(0);

  const onlineCount = useMemo(
    () => friends.filter((f) => f?.friend_status === "online").length,
    [friends]
  );

  const totalUnread = useMemo(
    () => Object.values(unreadCounts || {}).reduce((sum, n) => sum + Number(n || 0), 0),
    [unreadCounts]
  );

  const handleToggle = useCallback(() => {
    userToggledRef.current = true;
    setIsOpen((v) => !v);
  }, []);

  const handleShowNew = useCallback((e) => {
    e.stopPropagation();
    userToggledRef.current = true;
    setIsOpen(true);
  }, []);

  useEffect(() => {
    const prev = prevOnlineCountRef.current;
    if (prev === 0 && onlineCount > 0 && !userToggledRef.current) setIsOpen(true);
    prevOnlineCountRef.current = onlineCount;
  }, [onlineCount]);

  const bodyStyle = useMemo(() => ({
    overflow: "hidden",
    maxHeight: isOpen ? "420px" : "0px",
    opacity: isOpen ? 1 : 0,
    marginTop: isOpen ? "12px" : "0px",
    transition: "max-height 300ms ease-out, opacity 300ms ease-out, margin-top 300ms ease-out",
    pointerEvents: isOpen ? "auto" : "none",
  }), [isOpen]);

  return (
    <section className="w-full">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between gap-2 text-left select-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          <LuUsers size={16} className="text-text-muted shrink-0" />
          <span className="text-xs font-semibold tracking-wide uppercase truncate text-text-muted">
            Friends
          </span>

          {onlineCount >= 1 && (
            <Badge variant="success">
              {onlineCount > 99 ? "99+" : onlineCount} online
            </Badge>
          )}

          {totalUnread >= 1 && (
            <button type="button" onClick={handleShowNew} className="focus:outline-none">
              <Badge variant="brand">
                {totalUnread > 99 ? "99+" : totalUnread} new
              </Badge>
            </button>
          )}
        </div>

        <span className="text-text-faint">
          {isOpen ? <CiCircleChevUp size={18} /> : <CiCircleChevDown size={18} />}
        </span>
      </button>

      <div style={bodyStyle}>
        <div className="max-h-[260px] overflow-y-auto pr-1 tron-scrollbar-dark">
          {friends.length === 0 ? (
            <p className="py-2 text-xs text-text-faint">
              No friends yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
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

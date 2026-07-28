// # Filename: src/components/navbar/BottomTabBar.jsx
import React, { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CiHome, CiUser, CiChat1 } from "react-icons/ci";
import { LuTrophy } from "react-icons/lu";

import { useUI } from "../../context/uiContext";
import { useFriends } from "../../context/friendsContext";
import { useDirectMessage } from "../../context/directMessageContext";

const TABS = [
  { id: "home",        label: "Home",    Icon: CiHome },
  { id: "friends",     label: "Friends", Icon: CiUser },
  { id: "chat",        label: "Chat",    Icon: CiChat1 },
  { id: "leaderboard", label: "Ranks",   Icon: LuTrophy },
];

export default function BottomTabBar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { setSidebarOpen, setDMOpen } = useUI();
  const { pending } = useFriends();
  const { unreadCounts, groupUnreadCounts } = useDirectMessage();

  const totalUnread = useMemo(
    () =>
      Object.values(unreadCounts || {}).reduce((s, n) => s + Number(n || 0), 0) +
      Object.values(groupUnreadCounts || {}).reduce((s, n) => s + Number(n || 0), 0),
    [unreadCounts, groupUnreadCounts]
  );

  const pendingCount = pending?.received?.length ?? 0;

  const getBadge = (id) => {
    if (id === "friends") return pendingCount;
    if (id === "chat")    return totalUnread;
    return 0;
  };

  const isActive = (id) => {
    if (id === "home") return location.pathname === "/";
    if (id === "leaderboard") return location.pathname.startsWith("/leaderboard");
    return false;
  };

  const handleTab = (id) => {
    if (id === "home")        navigate("/");
    if (id === "friends")     setSidebarOpen(true);
    if (id === "chat")        setDMOpen(true);
    if (id === "leaderboard") navigate("/leaderboard");
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-[45] bg-background-app-panel/90 backdrop-blur-xl border-t border-border-soft"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Thin cyan line */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-cyan/40 to-transparent" />

      <div className="flex items-stretch h-16">
        {TABS.map(({ id, label, Icon }) => {
          const active = isActive(id);
          const badge  = getBadge(id);

          return (
            <button
              key={id}
              type="button"
              onClick={() => handleTab(id)}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 transition-colors duration-150 focus:outline-none ${
                active ? "text-brand-cyan" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {/* Active cyan bar */}
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-brand-cyan shadow-glow-cyan" />
              )}

              <div className="relative">
                <Icon size={22} />
                {badge > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center leading-none bg-brand-cyan text-background-app">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>

              <span className="text-[10px] font-semibold tracking-[0.1em] uppercase">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

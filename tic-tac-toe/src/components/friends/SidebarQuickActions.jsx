// # Filename: src/components/friends/SidebarQuickActions.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { IoPersonAddOutline } from "react-icons/io5";
import { MdGroup } from "react-icons/md";
import { LuTrophy } from "react-icons/lu";
import AddFriendForm from "./AddFriendForm";

function QuickActionTile({ icon, label, badge = 0, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg transition-colors focus:outline-none",
        active ? "bg-brand-cyan/10 text-brand-cyan" : "text-text-muted hover:text-text-secondary hover:bg-surface-elevated",
      ].join(" ")}
    >
      <span className="relative">
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center leading-none bg-brand-cyan text-background-app">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-semibold tracking-wide uppercase">{label}</span>
    </button>
  );
}

export default function SidebarQuickActions({ onOpenChatInbox, chatUnread = 0, onOpenLeaderboard }) {
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const wrapperRef = useRef(null);

  const closeAddFriend = useCallback(() => setAddFriendOpen(false), []);

  useEffect(() => {
    if (!addFriendOpen) return;
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) closeAddFriend();
    };
    const onKey = (e) => { if (e.key === "Escape") closeAddFriend(); };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [addFriendOpen, closeAddFriend]);

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex items-stretch gap-1 rounded-xl border border-border-soft bg-surface p-1">
        <QuickActionTile
          icon={<IoPersonAddOutline size={18} />}
          label="Add"
          active={addFriendOpen}
          onClick={() => setAddFriendOpen((v) => !v)}
        />
        <QuickActionTile
          icon={<MdGroup size={18} />}
          label="Chats"
          badge={chatUnread}
          onClick={onOpenChatInbox}
        />
        <QuickActionTile
          icon={<LuTrophy size={18} />}
          label="Ranks"
          onClick={onOpenLeaderboard}
        />
      </div>

      {addFriendOpen && (
        <div className="absolute left-0 right-0 z-30 mt-2 rounded-xl border border-border-soft bg-background-app-panel p-3 shadow-glow-cyan">
          <AddFriendForm showLabel onSuccess={closeAddFriend} />
        </div>
      )}
    </div>
  );
}

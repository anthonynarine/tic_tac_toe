// # Filename: src/components/lobby/components/InviteFriendModal.jsx
// ✅ New Code

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IoCloseSharp } from "react-icons/io5";
import { LuSearch } from "react-icons/lu";
import { IoIosSend } from "react-icons/io";

export default function InviteFriendModal({
  open,
  onClose,
  friends = [],
  onInvite,
  lobbyId,
  isInviting = false,
}) {
  const [query, setQuery] = useState("");
  const panelRef = useRef(null);

  // # Step 1: Close handler
  const close = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // # Step 2: ESC close + body scroll lock
  useEffect(() => {
    if (!open) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setQuery("");

    const onKeyDown = (e) => {
      if (e.key === "Escape") close();
    };

    window.addEventListener("keydown", onKeyDown);

    const t = setTimeout(() => {
      const el = panelRef.current?.querySelector("input");
      el?.focus?.();
    }, 80);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(t);
    };
  }, [open, close]);

  // # Step 3: Filter online friends + search
  const onlineFriends = useMemo(() => {
    const online = (friends || []).filter((f) => f?.friend_status === "online");
    const q = query.trim().toLowerCase();

    const filtered = !q
      ? online
      : online.filter((f) =>
          String(f?.friend_name || "").toLowerCase().includes(q)
        );

    return [...filtered].sort((a, b) =>
      String(a?.friend_name || "").localeCompare(String(b?.friend_name || ""))
    );
  }, [friends, query]);

  if (!open) return null;

  const modal = (
    <div
      className="
        fixed inset-0 z-[250]
        flex items-end sm:items-center justify-center
        px-0 sm:px-4
      "
      role="dialog"
      aria-modal="true"
      aria-label="Invite Friend"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {/* Backdrop (match DMDrawer) */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />

      {/* Accent bloom (subtle #1DA1F2) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background:
            "radial-gradient(circle at 50% 85%, rgba(29,161,242,0.22), transparent 55%)",
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        onPointerDown={(e) => e.stopPropagation()}
        className="
          relative w-full sm:max-w-[680px]

          /* Mobile: lifted bottom sheet */
          rounded-t-[28px] sm:rounded-2xl
          mb-[max(14px,env(safe-area-inset-bottom))]
          sm:mb-0

          /* Height */
          h-[min(82dvh,740px)]
          sm:h-auto sm:max-h-[78dvh]

          overflow-hidden
          bg-black/70 backdrop-blur
          border border-[#1DA1F2]/20
          shadow-[0_0_26px_rgba(29,161,242,0.12)]
        "
      >
        {/* Mobile handle */}
        <div className="sm:hidden flex justify-center pt-3">
          <div className="h-1 w-11 rounded-full bg-white/10" />
        </div>

        {/* Header (sticky) */}
        <div className="sticky top-0 z-20 px-4 sm:px-5 py-4 border-b border-[#1DA1F2]/15 bg-black/55 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[#1DA1F2]/70">
                Lobby {lobbyId}
              </div>
              <h2 className="mt-1 text-[17px] sm:text-[18px] font-semibold text-white/85">
                Invite an online friend
              </h2>
              <p className="mt-1 text-xs text-slate-200/45">
                Only online friends are shown.
              </p>
            </div>

            <button
              type="button"
              onClick={close}
              className="
                h-9 w-9 grid place-items-center rounded-xl
                border border-[#1DA1F2]/20 bg-[#1DA1F2]/10
                text-[#1DA1F2]/90 hover:text-[#1DA1F2]
                hover:bg-[#1DA1F2]/15 transition
              "
              aria-label="Close"
              title="Close"
            >
              <IoCloseSharp size={18} />
            </button>
          </div>

          {/* Search (DMDrawer-style input shell) */}
          <div className="mt-4">
            <div className="flex items-center gap-2 rounded-2xl border border-[#1DA1F2]/20 bg-black/40 px-3 py-2">
              <span className="text-[#1DA1F2]/70">
                <LuSearch size={16} />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search online friends..."
                className="
                  flex-1 bg-transparent outline-none
                  text-sm text-slate-100
                  placeholder:text-slate-200/40
                "
              />
            </div>
          </div>
        </div>

        {/* Body: single scroll region */}
        <div className="px-4 sm:px-5 py-4 overflow-y-auto tron-scrollbar-dark">
          {onlineFriends.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-sm text-slate-100/70">
                {query.trim()
                  ? "No matching online friends."
                  : "No friends online right now."}
              </p>
              <p className="mt-1 text-xs text-slate-200/45">
                Try again later — invites will work instantly when someone is online.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {onlineFriends.map((friend) => (
                <FriendRow
                  key={friendKey(friend)}
                  friend={friend}
                  onInvite={onInvite}
                  isInviting={isInviting}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Safe area spacer */}
        <div className="h-[max(10px,env(safe-area-inset-bottom))]" />
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function FriendRow({ friend, onInvite, isInviting }) {
  const name = friend?.friend_name || "Friend";

  return (
    <li
      className="
        rounded-2xl
        bg-white/[0.028]
        border border-[#1DA1F2]/12
        hover:bg-white/[0.04]
        hover:border-[#1DA1F2]/18
        transition
        px-4 py-3
        flex items-center justify-between gap-3
        shadow-[0_0_18px_rgba(29,161,242,0.06)]
      "
    >
      <div className="min-w-0 flex items-center gap-3">
        {/* Avatar bubble */}
        <div
          className="
            relative h-11 w-11 rounded-2xl grid place-items-center
            bg-black/25
            border border-[#1DA1F2]/18
            text-white/80 font-semibold
            shrink-0
          "
          style={{ boxShadow: "0 0 14px rgba(29,161,242,0.10)" }}
          aria-hidden="true"
        >
          {initials(name)}
          <span
            className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full"
            style={{
              background: "rgba(29,161,242,0.95)",
              boxShadow: "0 0 12px rgba(29,161,242,0.30)",
            }}
          >
            <span
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: "rgba(29,161,242,0.35)" }}
            />
          </span>
        </div>

        <div className="min-w-0">
          <div className="text-sm font-medium text-white/85 truncate">{name}</div>
          <div className="mt-0.5 text-[11px] text-slate-200/45">Online</div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onInvite?.(friend)}
        disabled={isInviting}
        className="
          h-9 w-9 grid place-items-center rounded-xl
          border border-[#1DA1F2]/20 bg-[#1DA1F2]/10
          text-[#1DA1F2] hover:bg-[#1DA1F2]/15 transition
          disabled:opacity-40
        "
        aria-label={`Invite ${name}`}
        title={isInviting ? "Inviting..." : "Invite"}
      >
        <IoIosSend size={18} />
      </button>
    </li>
  );
}

function friendKey(friend) {
  return String(
    friend?.id ??
      friend?.friend_id ??
      `${friend?.from_user_id ?? friend?.from_user}-${friend?.to_user_id ?? friend?.to_user}` ??
      friend?.friend_name
  );
}

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "??";
  const first = parts[0]?.[0] || "?";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${last}`.toUpperCase();
}

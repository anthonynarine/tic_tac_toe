// # Filename: src/components/lobby/components/InviteFriendModal.jsx
import React, { useMemo, useState } from "react";
import { IoClose } from "react-icons/io5";

/**
 * InviteFriendModal (lobby-scoped)
 * - Online friends only
 * - Mobile: bottom sheet
 * - Desktop: centered modal
 */
export default function InviteFriendModal({
  open,
  onClose,
  friends = [],
  onInvite,
  lobbyId,
  isInviting = false,
}) {
  const [query, setQuery] = useState("");

  const onlineFriends = useMemo(() => {
    // Step 1: Only online friends
    const online = (friends || []).filter((f) => f?.friend_status === "online");

    const q = query.trim().toLowerCase();
    if (!q) return online;

    return online.filter((f) =>
      String(f?.friend_name || "")
        .toLowerCase()
        .includes(q)
    );
  }, [friends, query]);

  // Step 2: Stable ordering
  const sortedOnline = useMemo(() => {
    const copy = [...onlineFriends];
    copy.sort((a, b) =>
      String(a?.friend_name || "").localeCompare(String(b?.friend_name || ""))
    );
    return copy;
  }, [onlineFriends]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Invite Friend"
      onMouseDown={(e) => {
        // Step 3: Close on backdrop click
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

      {/* Mobile: bottom sheet | Desktop: centered modal */}
      <div
        className={[
          "relative w-full sm:max-w-[560px]",
          "rounded-t-2xl sm:rounded-2xl",
          "border border-[#1DA1F2]/18 bg-[#05070c]/95",
          "shadow-[0_0_40px_rgba(29,161,242,0.10)]",
          // Mobile: keep it from going too tall; allow internal scrolling
          "max-h-[85vh] sm:max-h-[70vh]",
          "pb-[env(safe-area-inset-bottom)]",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#1DA1F2]/12">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/45">
              Lobby {lobbyId}
            </div>
            <h2 className="mt-1 text-base font-semibold text-cyan-50/85">
              Invite an online friend
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded-lg border border-white/10 bg-white/5 text-white/70 active:bg-white/10 sm:hover:bg-white/10"
            aria-label="Close"
            title="Close"
          >
            <IoClose size={18} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search online friends..."
            className={[
              "w-full rounded-xl border border-[#1DA1F2]/14 bg-black/30 px-3 py-2.5",
              "text-sm text-cyan-50/85 placeholder:text-cyan-200/30",
              "focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/20",
            ].join(" ")}
          />
          <p className="mt-2 text-[11px] text-cyan-200/35">
            Only online friends are shown.
          </p>
        </div>

        <div className="px-5 pb-5 pt-4 space-y-2 overflow-auto">
          {sortedOnline.length === 0 ? (
            <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-cyan-50/55">
              No friends online right now.
            </div>
          ) : (
            <ul className="space-y-2">
              {sortedOnline.map((friend) => (
                <li
                  key={friendKey(friend)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#1DA1F2]/10 bg-black/20 px-4 py-3 sm:hover:border-[#1DA1F2]/16"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-cyan-50/85 truncate">
                      {friend?.friend_name || "Friend"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-cyan-200/35">
                      Online
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onInvite?.(friend)}
                    disabled={isInviting}
                    className={[
                      "rounded-lg px-3 py-2 text-xs font-medium transition border",
                      "focus:outline-none focus:ring-2",
                      isInviting
                        ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                        : "border-[#1DA1F2]/20 bg-[#1DA1F2]/10 text-cyan-50/85 active:bg-[#1DA1F2]/15 sm:hover:bg-[#1DA1F2]/15 focus:ring-[#1DA1F2]/20",
                    ].join(" ")}
                  >
                    {isInviting ? "Inviting..." : "Invite"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
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

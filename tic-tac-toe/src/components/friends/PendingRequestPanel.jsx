// # Filename: src/components/friends/PendingRequestsPanel.jsx
// ✅ New Code

import React, { useCallback, useMemo, useState } from "react";
import { CiCircleChevDown, CiCircleChevUp } from "react-icons/ci";
import PendingFriendRequest from "./PendingFriendRequest";

export default function PendingRequestsPanel({
  requests = [],
  onAccept,
  onDecline,
  defaultOpen = false,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const count = requests.length;

  const handleToggle = useCallback(() => {
    setIsOpen((v) => !v);
  }, []);

  const bodyClassName = useMemo(() => {
    const base =
      "transition-all duration-300 ease-out will-change-[max-height,opacity]";
    return isOpen
      ? `${base} max-h-[420px] opacity-100 mt-3`
      : `${base} max-h-0 opacity-0 mt-0 pointer-events-none`;
  }, [isOpen]);

  return (
    <section className="w-full">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between gap-3 text-left select-none"
        aria-expanded={isOpen}
        aria-controls="pending-requests-panel-body"
      >
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-medium tracking-wide text-[#1DA1F2] truncate">
            Pending Requests
          </h3>

          {count > 0 && (
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
              aria-label={`${count} pending friend requests`}
              title={`${count} pending friend requests`}
            >
              {count}
            </span>
          )}
        </div>

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

      <div id="pending-requests-panel-body" className={bodyClassName}>
        {/* ✅ New Code: scroll container so this panel never blows up the sidebar */}
        <div className="max-h-[260px] overflow-y-auto pr-2 tron-scrollbar-dark mt-2">
          {count > 0 ? (
            <ul className="space-y-2">
              {requests.map((r) => (
                <PendingFriendRequest
                  key={r.id}
                  request={r}
                  onAccept={onAccept}
                  onDecline={onDecline}
                />
              ))}
            </ul>
          ) : (
            <div className="text-sm text-slate-400">No pending requests.</div>
          )}
        </div>
      </div>
    </section>
  );
}

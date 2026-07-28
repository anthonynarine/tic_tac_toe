// # Filename: src/components/friends/PendingRequestsPanel.jsx
// ✅ New Code

import React, { useCallback, useMemo, useState } from "react";
import { CiCircleChevDown, CiCircleChevUp } from "react-icons/ci";
import { LuUserPlus } from "react-icons/lu";
import PendingFriendRequest from "./PendingFriendRequest";
import Badge from "../ui/Badge";

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
          <LuUserPlus size={16} className="text-text-muted shrink-0" />
          <span className="text-xs font-semibold tracking-wide uppercase text-text-muted">
            Pending
          </span>

          {count > 0 && (
            <Badge variant="brand" aria-label={`${count} pending friend requests`}>
              {count}
            </Badge>
          )}
        </div>

        <span className="text-text-faint">
          {isOpen ? <CiCircleChevUp size={20} /> : <CiCircleChevDown size={20} />}
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
            <div className="text-sm text-text-faint">No pending requests.</div>
          )}
        </div>
      </div>
    </section>
  );
}

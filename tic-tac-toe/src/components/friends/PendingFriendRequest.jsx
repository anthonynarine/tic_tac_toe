// # Filename: src/components/friends/PendingFriendRequest.jsx
// ✅ New Code

import React, { useMemo } from "react";
import { CiCircleCheck, CiCircleRemove } from "react-icons/ci";

function resolveRequesterName(request) {
  const name =
    request?.from_user_name ||
    request?.fromUserName ||
    request?.from_username ||
    request?.from_user_email ||
    request?.from_email;

  if (name && String(name).trim()) return String(name).trim();
  return "Unknown";
}

export default function PendingFriendRequest({ request, onAccept, onDecline }) {
  const requesterName = useMemo(() => resolveRequesterName(request), [request]);

  return (
    <li>
      <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border-soft bg-surface">
        {/* Step 1: Greedy text column */}
        <div className="flex-1 min-w-0">
          {/* Desktop truncate; mobile allow wrap */}
          <p className="text-sm text-text-secondary leading-snug md:truncate md:whitespace-nowrap">
            <span className="text-text-muted">Request from</span>{" "}
            <span className="font-semibold text-text-primary">{requesterName}</span>
          </p>
        </div>

        {/* Step 2: Compact icon actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onAccept(request.id)}
            className="h-9 w-9 grid place-items-center rounded-lg text-brand-emerald/85 hover:text-brand-emerald hover:bg-brand-emerald/10 focus:outline-none focus:ring-2 focus:ring-brand-emerald/35"
            title="Accept"
            aria-label="Accept friend request"
          >
            <CiCircleCheck size={28} />
          </button>

          <button
            type="button"
            onClick={() => onDecline(request.id)}
            className="h-9 w-9 grid place-items-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-border-strong"
            title="Decline"
            aria-label="Decline friend request"
          >
            <CiCircleRemove size={28} />
          </button>
        </div>
      </div>
    </li>
  );
}

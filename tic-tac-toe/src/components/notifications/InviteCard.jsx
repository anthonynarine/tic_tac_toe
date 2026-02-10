// # Filename: src/components/notifications/InviteCard.jsx
// ✅ New Code

import React from "react";
import { CiCircleCheck, CiCircleRemove } from "react-icons/ci";

function resolveSenderName(invite) {
  const name =
    invite?.fromUserName ||
    invite?.from_user_name ||
    invite?.from_username ||
    invite?.fromUser?.username ||
    invite?.fromUser?.displayName ||
    invite?.fromUser?.name;

  return name && String(name).trim() ? String(name).trim() : "Unknown";
}

export default function InviteCard({ invite, onAccept, onDecline }) {
  const fromName = resolveSenderName(invite);

  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-700/40 bg-slate-900/35">
      {/* Step 1: Text gets max space */}
      <div className="flex-1 min-w-0">
        <p
          className={[
            "text-sm text-slate-200",
            // Mobile: allow wrap (more readable in a drawer)
            "whitespace-normal break-words",
            // Desktop+: keep it clean and single-line
            "sm:truncate sm:whitespace-nowrap",
          ].join(" ")}
        >
          <span className="text-slate-300">Invite from</span>{" "}
          <span className="font-semibold">{fromName}</span>
        </p>
      </div>

      {/* Step 2: Actions stay compact */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onAccept(invite)}
          className="h-9 w-9 sm:h-9 sm:w-9 grid place-items-center text-[#1DA1F2]/80 hover:text-[#1DA1F2] focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/35 rounded-md"
          aria-label="Accept invite"
          title="Accept"
        >
          <CiCircleCheck size={28} />
        </button>

        <button
          type="button"
          onClick={() => onDecline(invite)}
          className="h-9 w-9 sm:h-9 sm:w-9 grid place-items-center text-[#1DA1F2]/65 hover:text-[#1DA1F2] focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/35 rounded-md"
          aria-label="Decline invite"
          title="Decline"
        >
          <CiCircleRemove size={28} />
        </button>
      </div>
    </div>
  );
}

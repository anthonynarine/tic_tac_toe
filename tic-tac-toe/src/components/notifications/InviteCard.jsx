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
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-700/60 bg-slate-900/40">
      <p className="text-sm text-slate-200 truncate min-w-0">
        <span className="text-slate-300">Invite from</span>{" "}
        <span className="font-semibold">{fromName}</span>
      </p>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onAccept(invite)}
          className="h-9 w-9 grid place-items-center text-cyan-200/90 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 rounded-md"
          aria-label="Accept invite"
          title="Accept"
        >
          <CiCircleCheck size={28} />
        </button>

        <button
          type="button"
          onClick={() => onDecline(invite)}
          className="h-9 w-9 grid place-items-center text-cyan-200/70 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 rounded-md"
          aria-label="Decline invite"
          title="Decline"
        >
          <CiCircleRemove size={28} />
        </button>
      </div>
    </div>
  );
}

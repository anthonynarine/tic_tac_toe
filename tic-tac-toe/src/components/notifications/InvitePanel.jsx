// # Filename: src/components/notifications/InvitePanel.jsx
// ✅ New Code

import React from "react";
import InviteCard from "./InviteCard";

export default function InvitePanel({ invites, onAccept, onDecline }) {
  return (
    <section className="w-full">
      {/* Step 1: Header */}
      <header className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-cyan-300">Invites</h3>
        <span className="text-xs text-slate-400">{invites.length}</span>
      </header>

      {/* Step 2: Scroll-contained list (scroll after ~2 invites) */}
      <div className="max-h-[210px] overflow-y-auto pr-1">
        {invites.length === 0 ? (
          <div className="py-3 text-sm text-slate-400">
            No pending invites.
          </div>
        ) : (
          <ul className="space-y-2">
            {invites.map((invite) => (
              <li key={invite.inviteId}>
                <InviteCard
                  invite={invite}
                  onAccept={onAccept}
                  onDecline={onDecline}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

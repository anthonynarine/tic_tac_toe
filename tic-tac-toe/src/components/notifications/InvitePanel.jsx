
// # Filename: src/components/notifications/InvitePanel.jsx

import React from "react";
import InviteCard from "./InviteCard";

export default function InvitePanel({ invites = [], onAccept, onDecline }) {
  if (!invites.length) {
    return (
      <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-4 text-center text-sm text-slate-400">
        No pending invites
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {invites.map((invite) => (
        <InviteCard
          key={invite.inviteId}
          invite={invite}
          onAccept={onAccept}
          onDecline={onDecline}
        />
      ))}
    </div>
  );
}

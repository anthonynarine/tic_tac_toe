// # Filename: src/components/notifications/InvitePanel.jsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CiCircleChevDown, CiCircleChevUp, CiMail } from "react-icons/ci";
import InviteCard from "./InviteCard";

export default function InvitePanel({ invites = [], onAccept, onDecline }) {
  const inviteCount = invites.length;

  // Step 1: Closed by default
  const [isOpen, setIsOpen] = useState(false);

  // Step 2: Track whether the user manually toggled
  const userToggledRef = useRef(false);

  const handleToggle = useCallback(() => {
    userToggledRef.current = true;
    setIsOpen((v) => !v);
  }, []);

  // Step 3: Auto-open when invites appear (0 -> >0), unless user toggled
  useEffect(() => {
    if (userToggledRef.current) return;
    if (inviteCount > 0) setIsOpen(true);
  }, [inviteCount]);

  // Step 4: Optional auto-close when back to zero (unless user toggled)
  useEffect(() => {
    if (inviteCount === 0 && !userToggledRef.current) setIsOpen(false);
  }, [inviteCount]);

  // smoother animation using opacity + translate + max-height
  const bodyClassName = useMemo(() => {
    const base =
      "overflow-hidden transition-[max-height,opacity,transform] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[max-height,opacity,transform]";
    return isOpen
      ? `${base} max-h-[360px] opacity-100 translate-y-0 mt-3`
      : `${base} max-h-0 opacity-0 -translate-y-1 mt-0 pointer-events-none`;
  }, [isOpen]);

  // inner content fade (prevents “pop”)
  const innerClassName = useMemo(() => {
    const base =
      "transition-opacity duration-300 ease-out";
    return isOpen ? `${base} opacity-100` : `${base} opacity-0`;
  }, [isOpen]);

  const hasInvites = inviteCount > 0;

  return (
    <section className="w-full">
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between gap-3 text-left select-none"
        aria-expanded={isOpen}
        aria-controls="invites-panel-body"
      >
        <div className="flex items-center gap-2 min-w-0">
          <CiMail size={16} className="text-brand-cyan shrink-0" />
          <h3 className="text-sm font-medium tracking-wide text-brand-cyan truncate">
            Invites
          </h3>

          {hasInvites && (
            <span
              className="
                inline-flex items-center justify-center
                px-2.5 py-[1px] text-xs font-semibold rounded-full
                bg-brand-cyan/12 text-brand-cyan
                border border-brand-cyan/30
              "
              aria-label={`${inviteCount} pending invites`}
              title={`${inviteCount} pending invites`}
            >
              {inviteCount}
            </span>
          )}
        </div>

        <span className="text-brand-cyan/90" aria-hidden="true">
          {isOpen ? <CiCircleChevUp size={18} /> : <CiCircleChevDown size={18} />}
        </span>
      </button>

      {/* Body */}
      <div id="invites-panel-body" className={bodyClassName}>
        <div className={innerClassName}>
          <div className="max-h-[260px] overflow-y-auto pr-2 tron-scrollbar-dark">
            {isOpen && !hasInvites ? (
              <div className="py-3 text-sm text-text-faint">
                No pending invites.
              </div>
            ) : (
              <ul className="space-y-2">
                {invites.map((invite) => (
                  <li key={invite.inviteId || invite.id}>
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
        </div>
      </div>
    </section>
  );
}

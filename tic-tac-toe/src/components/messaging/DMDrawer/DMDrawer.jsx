// # Filename: src/components/messaging/DMDrawer/DMDrawer.jsx
// ✅ New Code

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IoIosSend } from "react-icons/io";
import { IoCloseSharp } from "react-icons/io5";
import { CiTrash, CiChat1 } from "react-icons/ci";

import { useUI } from "../../../context/uiContext";
import { useUserContext } from "../../../context/userContext";
import { useDirectMessage } from "../../../context/directMessageContext";

import MessageBubble from "../MessageBubble/MessageBubble";

/**
 * DMDrawer (HUD Edge Panel)
 *
 * Production Rules:
 * - Must be viewport-fixed (not parent-absolute) to avoid clipping on mobile.
 * - Must sit above Navbar (z-index).
 * - Mobile: backdrop + full-height drawer (100dvh).
 * - Desktop: edge panel, no backdrop, pointer events pass through.
 */
export default function DMDrawer() {
  const { user } = useUserContext();
  const { isDMOpen, setDMOpen } = useUI();

  const {
    activeChat,
    activeFriendId,
    messages,
    socket,
    sendMessage,
    closeChat,
    clearThread,
    deleteConversation,
    isLoading,
  } = useDirectMessage();

  const [draft, setDraft] = useState("");
  const endRef = useRef(null);

  // Step 0: delete confirm arm (2-tap)
  const [deleteArmed, setDeleteArmed] = useState(false);
  const deleteArmTimerRef = useRef(null);

  const isOpen = Boolean(isDMOpen);

  // Step 1: Resolve friendId (thread key)
  const friendId = useMemo(() => {
    if (activeFriendId) return Number(activeFriendId);
    if (!activeChat || !user?.id) return null;

    const me = Number(user.id);
    const from = Number(activeChat.from_user);
    const to = Number(activeChat.to_user);

    if (from && to) return from === me ? to : from;
    if (activeChat?.id) return Number(activeChat.id);

    return null;
  }, [activeFriendId, activeChat, user?.id]);

  // Step 2: Resolve thread messages
  const thread = useMemo(() => {
    if (!friendId) return [];
    return Array.isArray(messages?.[friendId]) ? messages[friendId] : [];
  }, [messages, friendId]);

  const title = useMemo(() => {
    if (!activeChat) return "Opening chat…";
    return activeChat.friend_name || activeChat.first_name || "Direct Message";
  }, [activeChat]);

  // Step 3: Determine realtime send availability
  const isSocketOpen = socket?.readyState === WebSocket.OPEN;
  const canInteract = Boolean(friendId);
  const canSend = Boolean(canInteract && isSocketOpen);

  // Step 4: Close (DM + UI)
  const handleClose = useCallback(() => {
    try {
      closeChat();
    } finally {
      setDMOpen(false);
      setDraft("");
      setDeleteArmed(false);
      if (deleteArmTimerRef.current) clearTimeout(deleteArmTimerRef.current);
    }
  }, [closeChat, setDMOpen]);

  // Step 5: Send message (WS only)
  const handleSend = useCallback(async () => {
    const msg = draft.trim();
    if (!msg || !canSend) return;

    try {
      await sendMessage(msg);
      setDraft("");
    } catch (err) {
      console.error("[DMDrawer] sendMessage failed:", err);
    }
  }, [draft, canSend, sendMessage]);

  /**
   * Step 6: Delete conversation (server) with 2-tap confirm.
   */
  const handleDeleteConversation = useCallback(async () => {
    if (!friendId) return;

    if (!deleteArmed) {
      setDeleteArmed(true);
      if (deleteArmTimerRef.current) clearTimeout(deleteArmTimerRef.current);
      deleteArmTimerRef.current = setTimeout(() => setDeleteArmed(false), 4000);
      return;
    }

    try {
      setDeleteArmed(false);
      if (deleteArmTimerRef.current) clearTimeout(deleteArmTimerRef.current);

      const ok = await deleteConversation(friendId);
      if (!ok) clearThread(friendId);

      handleClose();
    } catch (err) {
      console.error("[DMDrawer] deleteConversation failed:", err);
      setDeleteArmed(false);
    }
  }, [deleteArmed, deleteConversation, friendId, clearThread, handleClose]);

  // Step 7: Scroll to bottom when opened / new messages
  useEffect(() => {
    if (!isOpen) return;

    const t = setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 40);

    return () => clearTimeout(t);
  }, [isOpen, thread.length]);

  // Step 8: Escape closes
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") handleClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const statusText = !canInteract
    ? "Opening chat…"
    : isLoading
      ? "Loading…"
      : isSocketOpen
        ? "Direct Message"
        : "Realtime offline";

  return (
    // ✅ FIX 1: viewport-fixed overlay + high z-index (above navbar)
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/* ✅ FIX 2: Mobile backdrop so header can't hide behind nav + tap outside closes */}
      <button
        type="button"
        onClick={handleClose}
        aria-label="Close direct message drawer"
        className="
          lg:hidden
          absolute inset-0
          bg-black/60 backdrop-blur-[2px]
          pointer-events-auto
        "
      />

      <aside
        className="
          pointer-events-auto
          fixed lg:absolute
          top-0 right-0

          /* ✅ FIX 3: mobile uses true viewport height */
          h-[100dvh] lg:h-full
          max-h-[100dvh] lg:max-h-none

          /* widths */
          w-full sm:w-[420px] lg:w-[360px]
          max-w-[100vw] lg:max-w-[92vw]

          bg-black/70 backdrop-blur
          border-l border-[#1DA1F2]/20
          shadow-[0_0_26px_rgba(29,161,242,0.12)]
          flex flex-col
          overflow-hidden

          /* mobile: no rounding so it feels native */
          rounded-none sm:rounded-l-2xl

          /* critical for flex scroll areas */
          min-h-0
        "
        role="dialog"
        aria-label="Direct messages"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#1DA1F2]/15">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[#1DA1F2]">
                <CiChat1 size={18} />
              </span>
              <div className="text-sm font-semibold text-[#1DA1F2] truncate">
                {title}
              </div>
            </div>

            <div className="text-[12px] text-slate-200/60 flex items-center gap-2">
              <span>{statusText}</span>
              {canInteract && !isLoading && (
                <span
                  className={[
                    "px-2 py-[2px] rounded-full text-[11px] border",
                    isSocketOpen
                      ? "border-[#1DA1F2]/20 bg-[#1DA1F2]/10 text-[#1DA1F2]/90"
                      : "border-amber-400/20 bg-amber-400/10 text-amber-200",
                  ].join(" ")}
                >
                  {isSocketOpen ? "LIVE" : "REST"}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDeleteConversation}
              disabled={!canInteract}
              className={`
                h-9 w-9 grid place-items-center rounded-xl
                border bg-[#1DA1F2]/10 transition
                disabled:opacity-40
                ${
                  deleteArmed
                    ? "border-red-500/40 bg-red-500/10 text-red-300"
                    : "border-[#1DA1F2]/20 text-[#1DA1F2]/90 hover:text-[#1DA1F2] hover:bg-[#1DA1F2]/15"
                }
              `}
              aria-label={
                deleteArmed ? "Confirm delete conversation" : "Delete conversation"
              }
              title={deleteArmed ? "Tap again to delete" : "Delete conversation"}
            >
              <CiTrash size={18} />
            </button>

            <button
              type="button"
              onClick={handleClose}
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
        </div>

        {/* Messages (scroll region) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 tron-scrollbar-dark">
          {!canInteract ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-200/60">
              Opening chat…
            </div>
          ) : isLoading ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-200/60">
              Loading conversation…
            </div>
          ) : thread.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-200/60">
              No messages yet.
            </div>
          ) : (
            <>
              {thread.map((msg) => (
                <MessageBubble
                  key={msg.message_id || msg.id || msg.timestamp}
                  msg={msg}
                  currentUserId={user?.id}
                />
              ))}
              <div ref={endRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-[#1DA1F2]/15">
          <div className="flex items-center gap-2 rounded-2xl border border-[#1DA1F2]/20 bg-black/40 px-3 py-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                !canInteract
                  ? "Opening…"
                  : isLoading
                    ? "Loading…"
                    : isSocketOpen
                      ? "Type a message..."
                      : "Realtime offline…"
              }
              disabled={!canSend}
              className="
                flex-1 bg-transparent outline-none
                text-sm text-slate-100
                placeholder:text-slate-200/40
                disabled:opacity-60
              "
            />

            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend || !draft.trim()}
              className="
                h-9 w-9 grid place-items-center rounded-xl
                border border-[#1DA1F2]/20 bg-[#1DA1F2]/10
                text-[#1DA1F2] hover:bg-[#1DA1F2]/15 transition
                disabled:opacity-40
              "
              aria-label="Send message"
              title={canSend ? "Send" : "Realtime offline"}
            >
              <IoIosSend size={18} />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

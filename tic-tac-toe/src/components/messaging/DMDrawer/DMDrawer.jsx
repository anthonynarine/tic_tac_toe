// # Filename: src/components/messaging/DMDrawer/DMDrawer.jsx


import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IoIosSend } from "react-icons/io";
import { IoCloseSharp } from "react-icons/io5";
import { CiTrash, CiChat1 } from "react-icons/ci";

import { useUI } from "../../../context/uiContext";
import { useUserContext } from "../../../context/userContext";
import { useDirectMessage } from "../../../context/directMessageContext";

/**
 * DMDrawer (HUD Edge Panel)
 *
 * Rules:
 * - Anchored to the frame container (frame-body) top-right.
 * - NO backdrop. NO global click-block. NO disabling the app.
 * - Pointer events pass through everywhere except the drawer itself.
 */
export default function DMDrawer() {
  const { user } = useUserContext();
  const { isDMOpen, setDMOpen } = useUI();

  const {
    activeChat,
    activeFriendId,
    messages,
    sendMessage,
    closeChat,
    clearThread,
    isLoading,
  } = useDirectMessage();

  const [draft, setDraft] = useState("");
  const endRef = useRef(null);

  const isOpen = Boolean(isDMOpen);

  // # Step 1: Resolve the friendId (thread key)
  const friendId = useMemo(() => {
    if (activeFriendId) return Number(activeFriendId);

    if (!activeChat || !user?.id) return null;

    const me = Number(user.id);
    const from = Number(activeChat.from_user);
    const to = Number(activeChat.to_user);

    return from === me ? to : from;
  }, [activeFriendId, activeChat, user?.id]);

  // # Step 2: Resolve thread messages
  const thread = useMemo(() => {
    if (!friendId) return [];
    return Array.isArray(messages?.[friendId]) ? messages[friendId] : [];
  }, [messages, friendId]);

  const title = useMemo(() => {
    if (!activeChat) return "Opening chat…";
    return activeChat.friend_name || activeChat.first_name || "Direct Message";
  }, [activeChat]);

  const canInteract = Boolean(activeChat && friendId);

  // # Step 3: Close (DM + UI)
  const handleClose = useCallback(() => {
    try {
      closeChat();
    } finally {
      setDMOpen(false);
    }
  }, [closeChat, setDMOpen]);

  // # Step 4: Send message
  const handleSend = useCallback(async () => {
    const msg = draft.trim();
    if (!msg || !canInteract) return;

    try {
      await sendMessage(msg);
      setDraft("");
    } catch (err) {
      console.error("[DMDrawer] sendMessage failed:", err);
    }
  }, [draft, canInteract, sendMessage]);

  // # Step 5: Clear thread
  const handleClear = useCallback(() => {
    if (!friendId) return;
    clearThread(friendId);
  }, [clearThread, friendId]);

  // # Step 6: Scroll to bottom when opened / new messages
  useEffect(() => {
    if (!isOpen) return;

    const t = setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 40);

    return () => clearTimeout(t);
  }, [isOpen, thread.length]);

  // # Step 7: Escape closes
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") handleClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose]);

  // # Step 8: Keep DOM calm
  if (!isOpen) return null;

  return (
    /**
     * IMPORTANT:
     * This wrapper MUST be rendered inside a `relative` container (frame-body).
     * It uses pointer-events-none so it DOES NOT block the app.
     */
    <div className="absolute inset-0 z-[60] pointer-events-none">
      <aside
        className={`
          pointer-events-auto
          absolute top-0 right-0
          h-full
          w-[360px] max-w-[92vw]
          bg-black/70 backdrop-blur
          border-l border-[#1DA1F2]/20
          shadow-[0_0_26px_rgba(29,161,242,0.12)]
          flex flex-col
          overflow-hidden
          rounded-l-2xl
        `}
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
            <div className="text-[12px] text-slate-200/60">
              {canInteract ? "Direct Message" : isLoading ? "Loading…" : "Connecting…"}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClear}
              disabled={!canInteract || thread.length === 0}
              className="
                h-9 w-9 grid place-items-center rounded-xl
                border border-[#1DA1F2]/20 bg-[#1DA1F2]/10
                text-[#1DA1F2]/90 hover:text-[#1DA1F2]
                hover:bg-[#1DA1F2]/15 transition
                disabled:opacity-40 disabled:hover:bg-[#1DA1F2]/10
              "
              aria-label="Clear conversation"
              title="Clear conversation"
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 tron-scrollbar-dark">
          {!canInteract ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-200/60">
              {isLoading ? "Loading conversation…" : "Connecting…"}
            </div>
          ) : thread.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-200/60">
              No messages yet.
            </div>
          ) : (
            <>
              {thread.map((msg) => (
                <MessageBubble
                  key={msg.id || msg.timestamp}
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
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={canInteract ? "Type a message..." : "Connecting…"}
              disabled={!canInteract}
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
              disabled={!canInteract || !draft.trim()}
              className="
                h-9 w-9 grid place-items-center rounded-xl
                border border-[#1DA1F2]/20 bg-[#1DA1F2]/10
                text-[#1DA1F2] hover:bg-[#1DA1F2]/15 transition
                disabled:opacity-40
              "
              aria-label="Send message"
              title="Send"
            >
              <IoIosSend size={18} />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

/**
 * MessageBubble
 *
 * If you already have your own MessageBubble component,
 * keep using it and delete this stub.
 */
function MessageBubble({ msg, currentUserId }) {
  const isMe = Number(msg?.sender_id) === Number(currentUserId);

  return (
    <div className={`mb-2 flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[78%] rounded-2xl px-3 py-2 text-sm",
          "border",
          isMe
            ? "bg-[#1DA1F2]/10 border-[#1DA1F2]/30 text-slate-100"
            : "bg-white/5 border-white/10 text-slate-100",
        ].join(" ")}
      >
        <div className="whitespace-pre-wrap break-words">{msg?.content}</div>
        <div className="mt-1 text-[11px] text-slate-200/45">
          {msg?.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ""}
        </div>
      </div>
    </div>
  );
}

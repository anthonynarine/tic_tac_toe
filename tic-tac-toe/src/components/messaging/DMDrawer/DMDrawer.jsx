// # Filename: src/components/messaging/DMDrawer/DMDrawer.jsx
// ✅ New Code

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IoIosSend } from "react-icons/io";
import { IoCloseSharp, IoChevronBack } from "react-icons/io5";
import { CiTrash, CiChat1 } from "react-icons/ci";
import { MdGroup, MdGroupAdd, MdPersonAdd } from "react-icons/md";
import { PiDotsThreeVerticalBold } from "react-icons/pi";

import { useUI } from "../../../context/uiContext";
import { useUserContext } from "../../../context/userContext";
import { useDirectMessage } from "../../../context/directMessageContext";
import { useFriends } from "../../../context/friendsContext";

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
  const { friends } = useFriends();

  const {
    activeMode,
    activeChat,
    activeFriendId,
    activeGroup,
    activeGroupId,
    messages,
    groupMessages,
    groups,
    groupUnreadCounts,
    socket,
    sendMessage,
    closeChat,
    backToInbox,
    clearThread,
    clearGroupThread,
    deleteGroup,
    deleteConversation,
    createGroup,
    addGroupMembers,
    openGroup,
    isLoading,
  } = useDirectMessage();

  const [draft, setDraft] = useState("");
  const endRef = useRef(null);
  const prevThreadKeyRef = useRef(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const groupMenuRef = useRef(null);
  const [isDeleteGroupConfirmOpen, setIsDeleteGroupConfirmOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

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
    if (activeMode === "group") {
      if (!activeGroupId) return [];
      return Array.isArray(groupMessages?.[activeGroupId])
        ? groupMessages[activeGroupId]
        : [];
    }
    if (!friendId) return [];
    return Array.isArray(messages?.[friendId]) ? messages[friendId] : [];
  }, [activeMode, activeGroupId, groupMessages, messages, friendId]);

  // Identifies which conversation is open, independent of message count --
  // used to tell "switched to a different chat" apart from "new message arrived".
  const threadKey = activeMode === "group" ? `group:${activeGroupId}` : `dm:${friendId}`;

  useEffect(() => { setIsGroupMenuOpen(false); }, [threadKey]);

  useEffect(() => {
    if (!isGroupMenuOpen) return;
    const onDocClick = (e) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target)) setIsGroupMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setIsGroupMenuOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [isGroupMenuOpen]);

  const title = useMemo(() => {
    if (activeMode === "group") return activeGroup?.name || "Group Chat";
    if (!activeChat) return "Opening chat…";
    return activeChat.friend_name || activeChat.first_name || "Direct Message";
  }, [activeMode, activeGroup, activeChat]);

  const friendOptions = useMemo(() => {
    return (Array.isArray(friends) ? friends : [])
      .map((friend) => ({
        id: Number(friend?.friend_id),
        name: friend?.friend_name || "Friend",
        status: friend?.friend_status || "offline",
      }))
      .filter((friend) => friend.id);
  }, [friends]);

  const activeGroupMemberIds = useMemo(() => {
    return new Set(
      (activeGroup?.members || [])
        .map((member) => Number(member?.user_id))
        .filter(Boolean)
    );
  }, [activeGroup]);

  const addableFriendOptions = useMemo(() => {
    return friendOptions.filter((friend) => !activeGroupMemberIds.has(friend.id));
  }, [friendOptions, activeGroupMemberIds]);

  // Step 3: Determine realtime send availability
  const isSocketOpen = socket?.readyState === WebSocket.OPEN;
  const canInteract = activeMode === "group" ? Boolean(activeGroupId) : Boolean(friendId);
  const canSend = Boolean(canInteract && isSocketOpen);
  const activeGroupRole = useMemo(() => {
    if (activeMode !== "group" || !activeGroup?.members || !user?.id) return null;
    return activeGroup.members.find(
      (member) => Number(member?.user_id) === Number(user.id)
    )?.role || null;
  }, [activeMode, activeGroup, user?.id]);
  const isGroupOwner = activeGroupRole === "owner";

  // Step 4: Close (DM + UI)
  const handleClose = useCallback(() => {
    try {
      closeChat();
    } finally {
      setDMOpen(false);
      setDraft("");
      setDeleteArmed(false);
      setIsCreatingGroup(false);
      setIsAddingMembers(false);
      setIsGroupMenuOpen(false);
      setIsDeleteGroupConfirmOpen(false);
      setSelectedMemberIds([]);
      if (deleteArmTimerRef.current) clearTimeout(deleteArmTimerRef.current);
    }
  }, [closeChat, setDMOpen]);

  const handleBackToInbox = useCallback(() => {
    try {
      backToInbox();
    } finally {
      setDraft("");
      setDeleteArmed(false);
      setIsAddingMembers(false);
      setIsGroupMenuOpen(false);
      setIsDeleteGroupConfirmOpen(false);
    }
  }, [backToInbox]);

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

  const handleClearGroupHistory = useCallback(async () => {
    if (!activeGroupId) return;

    if (isGroupOwner) {
      setIsDeleteGroupConfirmOpen(true);
      return;
    }

    if (!deleteArmed) {
      setDeleteArmed(true);
      if (deleteArmTimerRef.current) clearTimeout(deleteArmTimerRef.current);
      deleteArmTimerRef.current = setTimeout(() => setDeleteArmed(false), 4000);
      return;
    }

    try {
      setDeleteArmed(false);
      if (deleteArmTimerRef.current) clearTimeout(deleteArmTimerRef.current);
      await clearGroupThread(activeGroupId);
    } catch (err) {
      console.error("[DMDrawer] clear group failed:", err);
      setDeleteArmed(false);
    }
  }, [activeGroupId, clearGroupThread, deleteArmed, isGroupOwner]);

  const handleConfirmDeleteGroup = useCallback(async () => {
    if (!activeGroupId || !isGroupOwner) return;

    try {
      await deleteGroup(activeGroupId);
      setIsDeleteGroupConfirmOpen(false);
      handleBackToInbox();
    } catch (err) {
      console.error("[DMDrawer] delete group failed:", err?.response?.data || err);
    }
  }, [activeGroupId, deleteGroup, handleBackToInbox, isGroupOwner]);

  const toggleSelectedMember = useCallback((memberId) => {
    setSelectedMemberIds((current) => {
      const key = Number(memberId);
      return current.includes(key)
        ? current.filter((id) => id !== key)
        : [...current, key];
    });
  }, []);

  const handleCreateGroup = useCallback(async () => {
    const name = groupName.trim();
    if (name.length < 2 || selectedMemberIds.length < 1) return;

    try {
      await createGroup({ name, memberIds: selectedMemberIds });
      setGroupName("");
      setSelectedMemberIds([]);
      setIsCreatingGroup(false);
    } catch (err) {
      console.error("[DMDrawer] create group failed:", err?.response?.data || err);
    }
  }, [createGroup, groupName, selectedMemberIds]);

  const handleAddMembers = useCallback(async () => {
    if (!activeGroupId || selectedMemberIds.length < 1) return;

    try {
      await addGroupMembers(activeGroupId, selectedMemberIds);
      setSelectedMemberIds([]);
      setIsAddingMembers(false);
    } catch (err) {
      console.error("[DMDrawer] add group members failed:", err?.response?.data || err);
    }
  }, [activeGroupId, addGroupMembers, selectedMemberIds]);

  // Step 7: Scroll to bottom when opened / new messages.
  // Switching to a different chat snaps instantly (no animated scroll through
  // the newly-mounted thread) -- only genuinely new messages in the thread
  // that's already open get the smooth scroll.
  useEffect(() => {
    if (!isOpen) return;

    const isThreadSwitch = prevThreadKeyRef.current !== threadKey;
    prevThreadKeyRef.current = threadKey;

    const t = setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: isThreadSwitch ? "auto" : "smooth" });
    }, isThreadSwitch ? 0 : 40);

    return () => clearTimeout(t);
  }, [isOpen, thread.length, threadKey]);

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

  const statusText = !activeMode
    ? "Messages"
    : !canInteract
    ? "Opening chat…"
    : isLoading
      ? "Loading…"
      : isSocketOpen
        ? activeMode === "group" ? "Group Chat" : "Direct Message"
        : "Realtime offline";

  const isInbox = !activeMode;
  const clearAction = activeMode === "group" ? handleClearGroupHistory : handleDeleteConversation;
  const showDeleteAction = activeMode === "direct" || (activeMode === "group" && isGroupOwner);

  return (
    <div className="fixed inset-0 lg:absolute lg:inset-0 z-[200] pointer-events-none">
      {/* ✅ FIX 2: Mobile backdrop so header can't hide behind nav + tap outside closes */}
      <button
        type="button"
        onClick={handleClose}
        aria-label="Close direct message drawer"
        className="
          lg:hidden
          absolute inset-0
          bg-black/70 backdrop-blur-[2px]
          pointer-events-auto
        "
      />

      <aside
        className="
          pointer-events-auto
          fixed lg:absolute
          top-0 right-0

          h-[100dvh] lg:h-full
          max-h-[100dvh] lg:max-h-none

          /* widths */
          w-full sm:w-[420px] lg:w-[360px]
          max-w-[100vw] lg:max-w-[92vw]

          bg-background-app/90 backdrop-blur-xl
          border-l border-brand-cyan/20
          shadow-glow-cyan
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
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-brand-cyan/15">
          <div className="flex items-center gap-2 min-w-0">
            {!isInbox ? (
              <button
                type="button"
                onClick={handleBackToInbox}
                className="h-9 w-9 grid place-items-center rounded-xl border border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan/90 hover:text-brand-cyan hover:bg-brand-cyan/15 transition"
                aria-label="Back to chat list"
                title="Back"
              >
                <IoChevronBack size={18} />
              </button>
            ) : null}

            <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-brand-cyan">
                {activeMode === "group" ? <MdGroup size={18} /> : <CiChat1 size={18} />}
              </span>
              <div className="text-sm font-semibold text-brand-cyan truncate">
                {isInbox ? "Chat" : title}
              </div>
            </div>

            <div className="text-[12px] text-text-secondary">
              <span>{statusText}</span>
            </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isInbox ? (
              <button
                type="button"
                onClick={() => {
                  setIsCreatingGroup((value) => !value);
                  setSelectedMemberIds([]);
                }}
                className="h-9 w-9 grid place-items-center rounded-xl border border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan/90 hover:text-brand-cyan hover:bg-brand-cyan/15 transition"
                aria-label="Create group"
                title="Create group"
              >
                <MdGroupAdd size={18} />
              </button>
            ) : null}

            {activeMode === "group" && !isInbox && !isAddingMembers ? (
              <div className="relative" ref={groupMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsGroupMenuOpen((value) => !value)}
                  className="h-9 w-9 grid place-items-center rounded-xl border border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan/90 hover:text-brand-cyan hover:bg-brand-cyan/15 transition"
                  aria-label="Group options"
                  aria-expanded={isGroupMenuOpen}
                  title="Group options"
                >
                  <PiDotsThreeVerticalBold size={18} />
                </button>

                {isGroupMenuOpen ? (
                  <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-border-soft bg-background-app-panel shadow-glow-cyan overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setIsGroupMenuOpen(false);
                        setIsAddingMembers(true);
                        setSelectedMemberIds([]);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-brand-cyan/10 hover:text-brand-cyan transition"
                    >
                      <MdPersonAdd size={16} />
                      Add members
                    </button>

                    {groups.length > 1 ? (
                      <>
                        <div className="border-t border-border-soft px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.25em] text-text-muted">
                          Switch chat
                        </div>
                        <ul className="max-h-52 overflow-y-auto tron-scrollbar-dark">
                          {groups.map((group) => {
                            const isActive = String(group.id) === String(activeGroupId);
                            const unread = Number(groupUnreadCounts?.[group.id] || 0);
                            return (
                              <li key={group.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsGroupMenuOpen(false);
                                    if (!isActive) openGroup(group);
                                  }}
                                  className={[
                                    "w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition",
                                    isActive
                                      ? "text-brand-cyan bg-brand-cyan/10"
                                      : "text-text-secondary hover:bg-brand-cyan/10 hover:text-text-primary",
                                  ].join(" ")}
                                >
                                  <span className="truncate">{group.name}</span>
                                  {unread > 0 && !isActive ? (
                                    <span className="shrink-0 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center bg-brand-cyan text-background-app">
                                      {unread > 9 ? "9+" : unread}
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {!isInbox && showDeleteAction ? (
              <button
                type="button"
                onClick={clearAction}
                disabled={!canInteract}
                className={`
                  h-9 w-9 grid place-items-center rounded-xl
                  border bg-brand-cyan/10 transition
                  disabled:opacity-40
                  ${
                    deleteArmed
                      ? "border-brand-rose/40 bg-brand-rose/10 text-brand-rose"
                      : "border-brand-cyan/20 text-brand-cyan/90 hover:text-brand-cyan hover:bg-brand-cyan/15"
                  }
                `}
                aria-label={
                  activeMode === "group"
                    ? isGroupOwner
                      ? "Delete group"
                      : deleteArmed ? "Confirm clear group history" : "Clear group history"
                    : deleteArmed ? "Confirm delete conversation" : "Delete conversation"
                }
                title={
                  activeMode === "group"
                    ? isGroupOwner
                      ? "Delete group"
                      : deleteArmed ? "Tap again to clear" : "Clear group history"
                    : deleteArmed ? "Tap again to delete" : "Delete conversation"
                }
              >
                <CiTrash size={18} />
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleClose}
              className="
                h-9 w-9 grid place-items-center rounded-xl
                border border-brand-cyan/20 bg-brand-cyan/10
                text-brand-cyan/90 hover:text-brand-cyan
                hover:bg-brand-cyan/15 transition
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
          {isInbox ? (
            <ChatInbox
              groups={groups}
              friendOptions={friendOptions}
              isCreatingGroup={isCreatingGroup}
              groupName={groupName}
              selectedMemberIds={selectedMemberIds}
              onGroupNameChange={setGroupName}
              onToggleMember={toggleSelectedMember}
              onCreateGroup={handleCreateGroup}
              onOpenGroup={openGroup}
              groupUnreadCounts={groupUnreadCounts}
            />
          ) : isAddingMembers ? (
            <MemberPicker
              title="Add members"
              friends={addableFriendOptions}
              selectedMemberIds={selectedMemberIds}
              onToggleMember={toggleSelectedMember}
              onSubmit={handleAddMembers}
              submitLabel="Add"
            />
          ) : !canInteract ? (
            <div className="h-full flex items-center justify-center text-sm text-text-secondary">
              Opening chat…
            </div>
          ) : isLoading ? (
            <div className="h-full flex items-center justify-center text-sm text-text-secondary">
              Loading conversation…
            </div>
          ) : thread.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-text-secondary">
              No messages yet.
            </div>
          ) : (
            <>
              {thread.map((msg) => (
                <MessageBubble
                  key={msg.message_id || msg.id || msg.timestamp}
                  msg={msg}
                  currentUserId={user?.id}
                  showSender={activeMode === "group"}
                />
              ))}
              <div ref={endRef} />
            </>
          )}
        </div>

        {/* Input */}
        {!isInbox && !isAddingMembers ? (
        <div className="p-3 border-t border-brand-cyan/15">
          <div className="flex items-center gap-2 rounded-2xl border border-brand-cyan/20 bg-surface px-3 py-2">
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
                text-sm text-text-primary
                placeholder:text-text-faint
                disabled:opacity-60
              "
            />

            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend || !draft.trim()}
              className="
                h-9 w-9 grid place-items-center rounded-xl
                border border-brand-cyan/20 bg-brand-cyan/10
                text-brand-cyan hover:bg-brand-cyan/15 transition
                disabled:opacity-40
              "
              aria-label="Send message"
              title={canSend ? "Send" : "Realtime offline"}
            >
              <IoIosSend size={18} />
            </button>
          </div>
        </div>
        ) : null}
      </aside>

      {isDeleteGroupConfirmOpen ? (
        <div className="absolute inset-0 z-[220] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto px-4">
          <div
            className="w-full max-w-[320px] rounded-xl border border-brand-rose/30 bg-background-app-panel p-4 shadow-[0_18px_60px_rgba(0,0,0,0.55)]"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-group-title"
          >
            <div id="delete-group-title" className="text-sm font-semibold text-text-primary">
              Delete {activeGroup?.name || "group"}?
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              This removes the group for every member.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteGroupConfirmOpen(false)}
                className="h-9 px-3 rounded-lg border border-border-soft bg-surface text-xs font-semibold text-text-secondary hover:text-text-primary transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteGroup}
                className="h-9 px-3 rounded-lg border border-brand-rose/30 bg-brand-rose/15 text-xs font-semibold text-brand-rose hover:bg-brand-rose/20 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChatInbox({
  groups,
  friendOptions,
  isCreatingGroup,
  groupName,
  selectedMemberIds,
  onGroupNameChange,
  onToggleMember,
  onCreateGroup,
  onOpenGroup,
  groupUnreadCounts,
}) {
  const hasGroups = Array.isArray(groups) && groups.length > 0;

  return (
    <div className="space-y-3">
      {isCreatingGroup ? (
        <div className="rounded-xl border border-brand-cyan/20 bg-surface p-3 space-y-3">
          <input
            type="text"
            value={groupName}
            onChange={(e) => onGroupNameChange(e.target.value)}
            placeholder="Group name"
            className="w-full rounded-xl border border-border-soft bg-background-app-panel px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-faint"
          />
          <MemberPicker
            title="Members"
            friends={friendOptions}
            selectedMemberIds={selectedMemberIds}
            onToggleMember={onToggleMember}
            onSubmit={onCreateGroup}
            submitLabel="Create"
            compact
          />
        </div>
      ) : null}

      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.28em] text-text-muted">
          Groups
        </div>
        {!hasGroups ? (
          <div className="rounded-xl border border-border-soft bg-surface px-3 py-8 text-center text-sm text-text-secondary">
            No groups yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {groups.map((group) => (
              <li key={group.id}>
                <button
                  type="button"
                  onClick={() => onOpenGroup(group)}
                  className="w-full flex items-center gap-3 rounded-xl border border-border-soft bg-surface px-3 py-3 text-left hover:border-brand-cyan/25 hover:bg-brand-cyan/10 transition"
                >
                  <span className="h-9 w-9 grid place-items-center rounded-xl border border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan">
                    <MdGroup size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-text-primary truncate">
                      {group.name}
                    </span>
                    <span className="block text-xs text-text-secondary">
                      {group.member_count || group.members?.length || 0} members
                    </span>
                  </span>
                  {Number(groupUnreadCounts?.[group.id] || 0) > 0 ? (
                    <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-brand-cyan text-background-app">
                      {Number(groupUnreadCounts?.[group.id] || 0) > 9 ? "9+" : groupUnreadCounts[group.id]}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MemberPicker({
  title,
  friends,
  selectedMemberIds,
  onToggleMember,
  onSubmit,
  submitLabel,
  compact = false,
}) {
  const canSubmit = selectedMemberIds.length > 0;

  return (
    <div className={compact ? "space-y-2" : "rounded-xl border border-brand-cyan/20 bg-surface p-3 space-y-3"}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.28em] text-text-muted">
          {title}
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="h-8 px-3 rounded-lg border border-brand-cyan/20 bg-brand-cyan/10 text-xs font-semibold text-brand-cyan hover:bg-brand-cyan/15 disabled:opacity-40 transition"
        >
          {submitLabel}
        </button>
      </div>

      {friends.length === 0 ? (
        <div className="rounded-xl border border-border-soft bg-background-app-panel px-3 py-6 text-center text-sm text-text-secondary">
          No available friends.
        </div>
      ) : (
        <ul className="space-y-1 max-h-56 overflow-y-auto tron-scrollbar-dark">
          {friends.map((friend) => {
            const checked = selectedMemberIds.includes(friend.id);
            return (
              <li key={friend.id}>
                <label className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-brand-cyan/10 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleMember(friend.id)}
                    className="h-4 w-4 accent-cyan-400"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-text-primary truncate">
                      {friend.name}
                    </span>
                    <span className="block text-xs text-text-secondary">
                      {friend.status}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

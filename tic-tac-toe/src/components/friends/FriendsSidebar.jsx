// # Filename: src/components/friends/FriendsSidebar.jsx
import React, { useEffect, useCallback, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CiChat1, CiHome, CiMenuFries, CiUser } from "react-icons/ci";
import { IoChevronForward, IoChevronBack } from "react-icons/io5";
import { LuBellRing, LuTrophy } from "react-icons/lu";

import { useFriends } from "../../context/friendsContext";
import { useDirectMessage } from "../../context/directMessageContext";
import { useUserContext } from "../../context/userContext";
import { useUI } from "../../context/uiContext";
import { useAuth } from "../../auth/hooks/useAuth";
import { useInviteContext } from "../../context/inviteContext";

import AccountPanel from "../user/AcountPanel";
import SidebarQuickActions from "./SidebarQuickActions";
import FriendsPanel from "./FriendsPanel";
import PendingRequestsPanel from "./PendingRequestPanel";
import InvitePanelContainer from "../notifications/InvitePanelContainer";

import { createInvite } from "../../api/inviteApi";
import { resolveRecipientUserId } from "../../invites/resolveRecipientUserId";
import { buildInviteLobbyUrl } from "../../invites/InviteNavigation";
import useActiveLobbyId from "../lobby/hooks/useActiveLobbyId";
import { showToast } from "../../utils/toast/Toast";

export default function FriendsSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lobbyId: activeLobbyId, gameType: activeLobbyGameType } = useActiveLobbyId();

  const {
    isSidebarOpen,
    setSidebarOpen,
    setDMOpen,
    isDMOpen,
    isSidebarCollapsed,
    setSidebarCollapsed,
  } = useUI();
  const { friends, pending, acceptRequest, declineRequest, refreshFriends } = useFriends();
  const { openChat, unreadCounts, groupUnreadCounts } = useDirectMessage();
  const { pendingInvites } = useInviteContext();
  const { isLoggedIn, user } = useUserContext();
  const { logout } = useAuth();

  const [isLgUp, setIsLgUp] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsLgUp(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const isMobile = !isLgUp;

  const closeSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);

  useEffect(() => {
    if (!isMobile || !isSidebarOpen) return;
    const onKey = (e) => { if (e.key === "Escape") closeSidebar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile, isSidebarOpen, closeSidebar]);

  useEffect(() => {
    if (!isMobile || !isSidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isMobile, isSidebarOpen]);

  useEffect(() => {
    if (!isMobile) return;
    closeSidebar();
  }, [location.pathname, isMobile, closeSidebar]);

  useEffect(() => { refreshFriends(); }, [refreshFriends]);

  const [pendingFriend, setPendingFriend] = useState(null);

  const handleOpenDM = useCallback((friend) => {
    if (!friend || friend?.friend_status !== "online") return;
    setPendingFriend(friend);
    setDMOpen(true);
    if (isMobile) setSidebarOpen(false);
  }, [setDMOpen, isMobile, setSidebarOpen]);

  useEffect(() => {
    if (!isDMOpen || !pendingFriend) return;
    const t = setTimeout(async () => {
      try { await openChat(pendingFriend); }
      catch (err) { console.error("[FriendsSidebar] openChat failed:", err); }
      finally { setPendingFriend(null); }
    }, 0);
    return () => clearTimeout(t);
  }, [isDMOpen, pendingFriend, openChat]);

  const handleInvite = useCallback(async (friend, gameType = "tic_tac_toe") => {
    try {
      if (!user?.id) return;
      const recipientUserId = resolveRecipientUserId(friend, user.id);
      if (!recipientUserId || Number(recipientUserId) === Number(user.id)) return;

      // Only reuse the currently-open lobby if it's for the same game type
      // the user picked -- otherwise a fresh lobby/game gets created.
      const useActiveLobby = Boolean(activeLobbyId) && activeLobbyGameType === gameType;

      const result = await createInvite({
        toUserId: recipientUserId,
        gameType,
        lobbyId: useActiveLobby ? activeLobbyId : undefined,
      });
      const lobbyId = result?.lobbyId || result?.lobby_id || result?.gameId || result?.game_id || (useActiveLobby ? activeLobbyId : undefined);
      const inviteId = result?.invite?.inviteId || result?.invite?.id || result?.inviteId || result?.invite_id;
      if (!lobbyId || !inviteId) { showToast("error", "Invite failed."); return; }
      if (useActiveLobby) { showToast("success", "Invite sent!"); return; }
      navigate(buildInviteLobbyUrl({ gameType, lobbyId, inviteId }));
      if (isMobile) closeSidebar();
    } catch { showToast("error", "Invite failed."); }
  }, [navigate, user?.id, activeLobbyId, activeLobbyGameType, isMobile, closeSidebar]);

  const pendingReceived = pending?.received || [];

  const totalChatUnread = useMemo(() => {
    const dmTotal = Object.values(unreadCounts || {}).reduce((sum, n) => sum + Number(n || 0), 0);
    const groupTotal = Object.values(groupUnreadCounts || {}).reduce((sum, n) => sum + Number(n || 0), 0);
    return dmTotal + groupTotal;
  }, [unreadCounts, groupUnreadCounts]);

  const handleOpenChatInbox = useCallback(() => {
    setDMOpen(true);
    if (isMobile) setSidebarOpen(false);
  }, [setDMOpen, isMobile, setSidebarOpen]);

  const handleAccept = useCallback(async (id) => {
    try { await acceptRequest(id); refreshFriends(); }
    catch (err) { console.error("Failed to accept request:", err); }
  }, [acceptRequest, refreshFriends]);

  const handleDecline = useCallback(async (id) => {
    try { await declineRequest(id); refreshFriends(); }
    catch (err) { console.error("Failed to decline request:", err); }
  }, [declineRequest, refreshFriends]);

  const handleLogin       = useCallback(() => { navigate("/login");       if (isMobile) closeSidebar(); }, [navigate, isMobile, closeSidebar]);
  const handleLeaderboard = useCallback(() => { navigate("/leaderboard"); if (isMobile) closeSidebar(); }, [navigate, isMobile, closeSidebar]);
  const handleHome = useCallback(() => { navigate("/"); if (isMobile) closeSidebar(); }, [navigate, isMobile, closeSidebar]);

  const overlayClassName = useMemo(() => {
    if (!isMobile) return "hidden";
    return [
      "fixed left-0 right-0 z-[55]",
      "top-[60px] sm:top-[64px]",
      "h-[calc(100dvh-60px)] sm:h-[calc(100dvh-64px)]",
      "bg-black/70 backdrop-blur-sm transition-opacity",
      isSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
    ].join(" ");
  }, [isMobile, isSidebarOpen]);

  const drawerClassName = useMemo(() => {
    const openClose = isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0";
    return [
      "text-text-primary flex flex-col",
      "transform transition-transform duration-300 ease-out",
      openClose,
      "fixed left-0 z-[70]",
      "top-[60px] sm:top-[64px]",
      "h-[calc(100dvh-60px)] sm:h-[calc(100dvh-64px)]",
      "w-[88vw] max-w-[360px]",
      "lg:static lg:z-auto lg:h-full lg:w-full lg:max-w-none",
    ].join(" ");
  }, [isSidebarOpen]);

  const collapsedRail = !isMobile && isSidebarCollapsed;

  return (
    <>
      <button type="button" aria-label="Close sidebar" onClick={closeSidebar} className={overlayClassName} />

      <aside
        className={`${drawerClassName} bg-background-app-panel border-r border-border-soft`}
        role={isMobile ? "dialog" : undefined}
        aria-modal={isMobile ? "true" : undefined}
        aria-label="Social sidebar"
      >
        {collapsedRail ? (
          <DesktopRail
            user={user}
            pendingCount={pendingReceived.length}
            inviteCount={pendingInvites.length}
            chatUnread={totalChatUnread}
            onExpand={() => setSidebarCollapsed(false)}
            onHome={handleHome}
            onFriends={() => setSidebarCollapsed(false)}
            onInvites={() => setSidebarCollapsed(false)}
            onChat={handleOpenChatInbox}
            onLeaderboard={handleLeaderboard}
          />
        ) : (
          <>
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-10 bg-background-app-panel border-b border-border-soft">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[10px] tracking-[0.35em] font-semibold uppercase text-text-muted">
              Menu
            </span>
            <button
              type="button"
              onClick={closeSidebar}
              className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-button bg-surface border border-border-soft text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
            >
              Close
            </button>
          </div>
        </div>

        {/* Desktop label */}
        <div className="hidden lg:flex items-center justify-between gap-2 px-4 pt-5 pb-3 border-b border-border-soft">
          <span className="text-[10px] tracking-[0.35em] font-semibold uppercase text-text-muted">
            Social
          </span>
          <button
            type="button"
            onClick={() => setSidebarCollapsed(true)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border-soft bg-surface text-text-muted transition hover:bg-surface-elevated hover:text-brand-cyan"
            aria-label="Collapse social sidebar"
            title="Collapse"
          >
            <IoChevronBack size={15} />
          </button>
        </div>

        {/* Quick actions toolbar */}
        <div className="px-3 pt-4">
          <SidebarQuickActions
            onOpenChatInbox={handleOpenChatInbox}
            chatUnread={totalChatUnread}
            onOpenLeaderboard={handleLeaderboard}
          />
        </div>

        {/* Content -- flat divided list, no per-section boxes */}
        <div className="flex-1 overflow-y-auto lol-scrollbar">
          <div className="px-3 py-3 divide-y divide-border-soft/60">
            <div className="py-3 first:pt-0">
              <InvitePanelContainer />
            </div>
            <div className="py-3">
              <FriendsPanel
                friends={friends}
                user={user}
                onFriendClick={handleOpenDM}
                onChatOpen={handleOpenDM}
                onInvite={handleInvite}
                unreadCounts={unreadCounts}
              />
            </div>
            <div className="py-3 last:pb-0">
              <PendingRequestsPanel
                requests={pendingReceived}
                onAccept={handleAccept}
                onDecline={handleDecline}
              />
            </div>
          </div>
        </div>

        {/* Sticky account footer */}
        <div className="shrink-0 border-t border-border-soft px-3 py-3 bg-background-app-panel">
          <AccountPanel
            isLoggedIn={isLoggedIn}
            user={user}
            onLogin={handleLogin}
            onLogout={logout}
          />
        </div>
          </>
        )}
      </aside>
    </>
  );
}

function RailButton({ icon, label, badge = 0, onClick, active = false, urgent = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative grid h-11 w-11 place-items-center rounded-xl border transition",
        active
          ? "border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan"
          : urgent
            ? "border-amber-300/35 bg-amber-300/10 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.18)] hover:bg-amber-300/15"
            : "border-transparent text-text-muted hover:border-border-soft hover:bg-surface hover:text-brand-cyan",
      ].join(" ")}
      aria-label={label}
      title={label}
    >
      {urgent ? (
        <span className="absolute inset-0 rounded-xl border border-amber-200/30 animate-pulse" />
      ) : null}
      {icon}
      {badge > 0 ? (
        <span className={[
          "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-background-app",
          urgent ? "bg-amber-300" : "bg-brand-cyan",
        ].join(" ")}>
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  );
}

function DesktopRail({
  user,
  pendingCount,
  inviteCount,
  chatUnread,
  onExpand,
  onHome,
  onFriends,
  onInvites,
  onChat,
  onLeaderboard,
}) {
  const initial = (user?.first_name || user?.email || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="hidden h-full flex-col items-center justify-between py-3 lg:flex">
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onExpand}
          className="grid h-10 w-10 place-items-center rounded-xl border border-border-soft bg-surface text-text-secondary transition hover:bg-surface-elevated hover:text-brand-cyan"
          aria-label="Expand social sidebar"
          title="Expand"
        >
          <IoChevronForward size={16} />
        </button>

        <div className="grid h-10 w-10 place-items-center rounded-xl border border-brand-cyan/20 bg-brand-cyan/10 text-sm font-bold text-brand-cyan">
          {initial}
        </div>

        <div className="h-px w-10 bg-border-soft" />

        <RailButton icon={<CiHome size={22} />} label="Home" onClick={onHome} />
        <RailButton icon={<CiUser size={22} />} label="Friends" badge={pendingCount} onClick={onFriends} />
        <RailButton icon={<LuBellRing size={20} />} label="Invites" badge={inviteCount} urgent={inviteCount > 0} onClick={onInvites} />
        <RailButton icon={<CiChat1 size={22} />} label="Chat" badge={chatUnread} onClick={onChat} />
        <RailButton icon={<LuTrophy size={20} />} label="Ranks" onClick={onLeaderboard} />
      </div>

      <RailButton icon={<CiMenuFries size={22} />} label="Expand menu" onClick={onExpand} />
    </div>
  );
}

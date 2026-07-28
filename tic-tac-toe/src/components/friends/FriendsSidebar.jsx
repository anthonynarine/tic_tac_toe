// # Filename: src/components/friends/FriendsSidebar.jsx
import React, { useEffect, useCallback, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { useFriends } from "../../context/friendsContext";
import { useDirectMessage } from "../../context/directMessageContext";
import { useUserContext } from "../../context/userContext";
import { useUI } from "../../context/uiContext";
import { useAuth } from "../../auth/hooks/useAuth";

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

  const { isSidebarOpen, setSidebarOpen, setDMOpen, isDMOpen } = useUI();
  const { friends, pending, acceptRequest, declineRequest, refreshFriends } = useFriends();
  const { openChat, unreadCounts, groupUnreadCounts } = useDirectMessage();
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

  return (
    <>
      <button type="button" aria-label="Close sidebar" onClick={closeSidebar} className={overlayClassName} />

      <aside
        className={`${drawerClassName} bg-background-app-panel border-r border-border-soft`}
        role={isMobile ? "dialog" : undefined}
        aria-modal={isMobile ? "true" : undefined}
        aria-label="Social sidebar"
      >
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
        <div className="hidden lg:flex items-center px-4 pt-5 pb-3 border-b border-border-soft">
          <span className="text-[10px] tracking-[0.35em] font-semibold uppercase text-text-muted">
            Social
          </span>
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
      </aside>
    </>
  );
}

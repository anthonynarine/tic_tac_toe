// ✅ New Code
// # Filename: src/components/friends/FriendsSidebar.jsx
// Step 1: Mobile drawer starts BELOW navbar (top offset) so content never scrolls under the navbar.
// Step 2: Overlay also starts BELOW navbar so hamburger remains clickable.
// Step 3: Scroll is MOBILE-ONLY (no desktop scrollbar).
// Step 4: Drawer header is sticky (mobile) so sections never scroll under it.
// Step 5: ESC closes + body scroll lock (mobile only).

import React, { useEffect, useCallback, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { useFriends } from "../../context/friendsContext";
import { useDirectMessage } from "../../context/directMessageContext";
import { useUserContext } from "../../context/userContext";
import { useUI } from "../../context/uiContext";

import { useAuth } from "../../auth/hooks/useAuth";
import useGameCreation from "../game/hooks/useGameCreation";

import GamesPanel from "../game/GamesPanel";
import AccountPanel from "../user/AcountPanel";

import AddFriendPanel from "./AddFriendPanel";
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
  const activeLobbyId = useActiveLobbyId();

  const { isSidebarOpen, setSidebarOpen, setDMOpen, isDMOpen } = useUI();

  const { friends, pending, acceptRequest, declineRequest, refreshFriends } =
    useFriends();

  const { openChat, unreadCounts } = useDirectMessage();
  const { isLoggedIn, user } = useUserContext();
  const { logout } = useAuth();
  const { createNewGame } = useGameCreation();

  // # Step 1: Track lg breakpoint to separate “mobile drawer” vs “desktop dock”
  const [isLgUp, setIsLgUp] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 1024px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mq = window.matchMedia("(min-width: 1024px)");
    const handleChange = () => setIsLgUp(mq.matches);

    handleChange();
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const isMobile = !isLgUp;

  // # Step 2: Close helper
  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, [setSidebarOpen]);

  // # Step 3: ESC closes (mobile only)
  useEffect(() => {
    if (!isMobile || !isSidebarOpen) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape") closeSidebar();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobile, isSidebarOpen, closeSidebar]);

  // # Step 4: Lock body scroll when drawer is open (mobile only)
  useEffect(() => {
    if (!isMobile || !isSidebarOpen) return undefined;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobile, isSidebarOpen]);

  // # Step 5: Auto-close on route change (mobile only)
  useEffect(() => {
    if (!isMobile) return;
    closeSidebar();
  }, [location.pathname, isMobile, closeSidebar]);

  // # Step 6: Refresh friends on mount
  useEffect(() => {
    refreshFriends();
  }, [refreshFriends]);

  // # Step 7: DM open intent + race-safe openChat
  const [pendingFriend, setPendingFriend] = useState(null);

  const handleOpenDM = useCallback(
    (friend) => {
      if (!friend) return;
      if (friend?.friend_status !== "online") return;

      setPendingFriend(friend);
      setDMOpen(true);

      if (isMobile) {
        setSidebarOpen(false);
      }
    },
    [setDMOpen, isMobile, setSidebarOpen]
  );

  useEffect(() => {
    if (!isDMOpen || !pendingFriend) return undefined;

    const t = setTimeout(async () => {
      try {
        await openChat(pendingFriend);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[FriendsSidebar] openChat failed:", err);
      } finally {
        setPendingFriend(null);
      }
    }, 0);

    return () => clearTimeout(t);
  }, [isDMOpen, pendingFriend, openChat]);

  // # Step 8: Game actions
  const startMultiplayerGame = useCallback(async () => {
    try {
      const newGame = await createNewGame(user?.first_name || "Player", false);
      if (!newGame?.id) return;

      const params = new URLSearchParams();
      if (newGame?.sessionKey) params.set("sessionKey", String(newGame.sessionKey));

      const suffix = params.toString() ? `?${params.toString()}` : "";
      navigate(`/lobby/${newGame.id}${suffix}`);

      if (isMobile) closeSidebar();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Multiplayer error:", err);
    }
  }, [createNewGame, navigate, user?.first_name, isMobile, closeSidebar]);

  const startAIGame = useCallback(async () => {
    try {
      const newGame = await createNewGame(user?.first_name || "Player", true);
      if (newGame?.id) navigate(`/games/${newGame.id}`);

      if (isMobile) closeSidebar();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("AI game error:", err);
    }
  }, [createNewGame, navigate, user?.first_name, isMobile, closeSidebar]);

  const goHome = useCallback(() => {
    navigate("/");
    if (isMobile) closeSidebar();
  }, [navigate, isMobile, closeSidebar]);

  // # Step 9: Invite flow
  const handleInvite = useCallback(
    async (friend) => {
      try {
        if (!user?.id) return;

        const recipientUserId = resolveRecipientUserId(friend, user.id);
        if (!recipientUserId) return;
        if (Number(recipientUserId) === Number(user.id)) return;

        const result = await createInvite({
          toUserId: recipientUserId,
          gameType: "tic_tac_toe",
          lobbyId: activeLobbyId || undefined,
        });

        const lobbyId =
          result?.lobbyId ||
          result?.lobby_id ||
          result?.gameId ||
          result?.game_id ||
          activeLobbyId;

        const inviteId =
          result?.invite?.inviteId ||
          result?.invite?.id ||
          result?.inviteId ||
          result?.invite_id;

        if (!lobbyId || !inviteId) {
          // eslint-disable-next-line no-console
          console.error("[Invite] missing lobbyId/inviteId:", result);
          showToast("error", "Invite failed (missing lobbyId/inviteId).");
          return;
        }

        if (activeLobbyId) {
          showToast("success", "Invite sent!");
          return;
        }

        const url = buildInviteLobbyUrl({ lobbyId, inviteId });
        navigate(url);

        if (isMobile) closeSidebar();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Invite failed:", error);
        showToast("error", "Invite failed.");
      }
    },
    [navigate, user?.id, activeLobbyId, isMobile, closeSidebar]
  );

  // # Step 10: Pending accept/decline
  const pendingReceived = pending?.received || [];

  const handleAccept = useCallback(
    async (id) => {
      try {
        await acceptRequest(id);
        refreshFriends();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to accept request:", error);
      }
    },
    [acceptRequest, refreshFriends]
  );

  const handleDecline = useCallback(
    async (id) => {
      try {
        await declineRequest(id);
        refreshFriends();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to decline request:", error);
      }
    },
    [declineRequest, refreshFriends]
  );

  // # Step 11: Account actions
  const handleLogin = useCallback(() => {
    navigate("/login");
    if (isMobile) closeSidebar();
  }, [navigate, isMobile, closeSidebar]);

  const handleProfile = useCallback(() => {
    navigate("/profile");
    if (isMobile) closeSidebar();
  }, [navigate, isMobile, closeSidebar]);

  const handleAbout = useCallback(() => {
    navigate("/technical-paper");
    if (isMobile) closeSidebar();
  }, [navigate, isMobile, closeSidebar]);

  /**
   * # Step 12: Drawer sizing + navbar offsets
   * Navbar heights in your Navbar.jsx:
   * - base: 76px
   * - sm:   80px
   * - md:   84px
   *
   * Mobile drawer runs until lg, so we offset top and height accordingly.
   */
  const overlayClassName = useMemo(() => {
    if (!isMobile) return "hidden";

    return [
      // ✅ below navbar so hamburger remains clickable
      "fixed left-0 right-0 z-[55]",
      "top-[76px] sm:top-[80px] md:top-[84px]",
      "h-[calc(100dvh-76px)] sm:h-[calc(100dvh-80px)] md:h-[calc(100dvh-84px)]",
      "bg-black/60 backdrop-blur-sm transition-opacity",
      isSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
    ].join(" ");
  }, [isMobile, isSidebarOpen]);

  const drawerClassName = useMemo(() => {
    // Closed on mobile: offscreen LEFT. Desktop always visible.
    const openClose = isSidebarOpen
      ? "translate-x-0"
      : "-translate-x-full lg:translate-x-0";

    return [
      "text-slate-100 flex flex-col",
      "bg-black/85 backdrop-blur-xl",
      "border-r border-[#1DA1F2]/15",
      "shadow-[0_0_40px_rgba(29,161,242,0.14)]",
      "transform transition-transform duration-300 ease-out",
      openClose,

      // ✅ Mobile drawer: below navbar
      "fixed left-0 z-[70]",
      "top-[76px] sm:top-[80px] md:top-[84px]",
      "h-[calc(100dvh-76px)] sm:h-[calc(100dvh-80px)] md:h-[calc(100dvh-84px)]",
      "w-[88vw] max-w-[380px]",

      // ✅ Desktop dock
      "lg:static lg:z-auto lg:h-full lg:w-full lg:max-w-none",
    ].join(" ");
  }, [isSidebarOpen]);

  return (
    <>
      {/* ✅ Mobile overlay (tap outside closes) */}
      <button
        type="button"
        aria-label="Close sidebar overlay"
        onClick={closeSidebar}
        className={overlayClassName}
      />

      {/* ✅ Drawer / docked sidebar */}
      <aside
        className={drawerClassName}
        role={isMobile ? "dialog" : undefined}
        aria-modal={isMobile ? "true" : undefined}
        aria-label="Friends sidebar"
      >
        {/* ✅ Sticky drawer header (mobile only) so content never scrolls under it */}
        <div className="lg:hidden sticky top-0 z-10 bg-black/70 backdrop-blur-xl border-b border-[#1DA1F2]/10">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="text-[11px] tracking-[0.35em] text-[#1DA1F2]/70">
              MENU
            </div>

            <button
              type="button"
              onClick={closeSidebar}
              className="rounded-xl border border-[#1DA1F2]/20 bg-black/40 px-3 py-2 text-xs text-[#1DA1F2]/80 hover:bg-[#1DA1F2]/10"
            >
              Close
            </button>
          </div>
        </div>

        {/* ✅ Content area
            - Mobile: internal scroll enabled
            - Desktop: no internal scroll (no scrollbar) — page handles scrolling
        */}
        <div className="flex-1 px-4 pb-4 pt-5 space-y-4 overflow-y-auto lg:overflow-visible">
          <GamesPanel
            isLoggedIn={isLoggedIn}
            onGoHome={goHome}
            onStartMultiplayer={startMultiplayerGame}
            onStartAI={startAIGame}
          />

          <AddFriendPanel />
          <InvitePanelContainer />

          <FriendsPanel
            friends={friends}
            user={user}
            onFriendClick={handleOpenDM}
            onChatOpen={handleOpenDM}
            onInvite={handleInvite}
            unreadCounts={unreadCounts}
          />

          <PendingRequestsPanel
            requests={pendingReceived}
            onAccept={handleAccept}
            onDecline={handleDecline}
            onChatOpen={handleOpenDM}
          />

          <AccountPanel
            isLoggedIn={isLoggedIn}
            user={user}
            onLogin={handleLogin}
            onLogout={logout}
            onProfile={handleProfile}
            onAbout={handleAbout}
          />
        </div>
      </aside>
    </>
  );
}

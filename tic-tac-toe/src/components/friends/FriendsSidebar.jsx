// # Filename: src/components/friends/FriendsSidebar.jsx
// ✅ New Code

import React, { useEffect, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useFriends } from "../context/friendsContext";
import { useDirectMessage } from "../context/directMessageContext";
import { useUserContext } from "../context/userContext";
import { useUI } from "../context/uiContext";

import { useAuth } from "../auth/hooks/useAuth";
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

import styles from "./FriendsSidebar.module.css";

export default function FriendsSidebar() {
  const navigate = useNavigate();

  const { isSidebarOpen, setDMOpen, isDMOpen } = useUI();
  const { friends, pending, acceptRequest, declineRequest, refreshFriends } =
    useFriends();

  const { openChat, unreadCounts } = useDirectMessage();
  const { isLoggedIn, user } = useUserContext();
  const { logout } = useAuth();
  const { createNewGame } = useGameCreation();

  // # Step 1: Stage the friend we intend to connect to AFTER drawer is open
  const [pendingFriend, setPendingFriend] = useState(null);

  // # Step 2: Refresh friends on mount
  useEffect(() => {
    refreshFriends();
  }, [refreshFriends]);

  /**
   * # Step 3: Intent-only handler (no socket calls here)
   * - Opens UI immediately
   * - Stores friend intent
   */
  const handleOpenDM = useCallback(
    (friend) => {
      if (!friend) return;
      if (friend?.friend_status !== "online") return;

      setPendingFriend(friend);
      setDMOpen(true);
    },
    [setDMOpen]
  );

  /**
   * # Step 4: Connect ONLY once the UI state says the drawer is open.
   * Removes the “click twice” race.
   */
  useEffect(() => {
    if (!isDMOpen || !pendingFriend) return;

    // # Step 1: Defer one tick so UI state + refs settle everywhere
    const t = setTimeout(async () => {
      try {
        await openChat(pendingFriend);
      } catch (err) {
        console.error("[FriendsSidebar] openChat failed:", err);
      } finally {
        setPendingFriend(null);
      }
    }, 0);

    return () => clearTimeout(t);
  }, [isDMOpen, pendingFriend, openChat]);

  // # Step 5: Game actions
  const startMultiplayerGame = useCallback(async () => {
    try {
      const newGame = await createNewGame(user?.first_name || "Player", false);
      if (!newGame?.id) return;

      // ✅ Host lobby entry invariant: must include ?sessionKey=...
      const params = new URLSearchParams();
      if (newGame?.sessionKey) {
        params.set("sessionKey", String(newGame.sessionKey));
      }

      const suffix = params.toString() ? `?${params.toString()}` : "";
      navigate(`/lobby/${newGame.id}${suffix}`);
    } catch (err) {
      console.error("Multiplayer error:", err);
    }
  }, [createNewGame, navigate, user?.first_name]);

  const startAIGame = useCallback(async () => {
    try {
      const newGame = await createNewGame(user?.first_name || "Player", true);
      if (newGame?.id) navigate(`/games/${newGame.id}`);
    } catch (err) {
      console.error("AI game error:", err);
    }
  }, [createNewGame, navigate, user?.first_name]);

  const goHome = useCallback(() => navigate("/"), [navigate]);

  // # Step 6: Invite v2 (HTTPS create, Notification WS delivers)
  const handleInvite = useCallback(
    async (friend) => {
      try {
        const recipientUserId = resolveRecipientUserId(friend, user?.id);
        if (!recipientUserId) return;

        if (Number(recipientUserId) === Number(user?.id)) return;

        const result = await createInvite({
          toUserId: recipientUserId,
          gameType: "tic_tac_toe",
        });

        // # Step 1: Normalize response (supports minor backend naming drift)
        const lobbyId =
          result?.lobbyId || result?.lobby_id || result?.gameId || result?.game_id;

        const inviteId =
          result?.invite?.inviteId ||
          result?.invite?.id ||
          result?.inviteId ||
          result?.invite_id;

        if (!lobbyId || !inviteId) {
          console.error(
            "[Invite v2] Missing lobbyId/inviteId from createInvite response:",
            result
          );
          return;
        }

        // # Step 2: Sender must enter lobby WITH invite query param
        const url = buildInviteLobbyUrl({ lobbyId, inviteId });
        navigate(url);
      } catch (error) {
        console.error("Invite v2: Failed to create invite:", error);
      }
    },
    [navigate, user?.id]
  );

  // # Step 7: Pending accept/decline
  const handleAccept = useCallback(
    async (id) => {
      try {
        await acceptRequest(id);
        refreshFriends();
      } catch (error) {
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
        console.error("Failed to decline request:", error);
      }
    },
    [declineRequest, refreshFriends]
  );

  const pendingReceived = pending?.received || [];

  // # Step 8: Account actions
  const handleLogin = useCallback(() => navigate("/login"), [navigate]);
  const handleProfile = useCallback(() => navigate("/profile"), [navigate]);
  const handleAbout = useCallback(() => navigate("/technical-paper"), [navigate]);

  return (
    <div
      className={`${styles.friendsSidebar} ${
        isSidebarOpen ? styles.open : ""
      }`}
    >
      <div className="px-4 pb-4 pt-7 space-y-4">
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
    </div>
  );
}

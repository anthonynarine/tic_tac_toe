// # Filename: src/components/friends/FriendsSidebar.jsx
// ✅ New Code

import React, { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { useFriends } from "../context/friendsContext";
import { useDirectMessage } from "../context/directMessageContext";
import { useUserContext } from "../context/userContext";
import { useUI } from "../context/uiContext";

// ✅ New Code
import { useAuth } from "../auth/hooks/useAuth";
import useGameCreation from "../hooks/game/useGameCreation";
import GamesPanel from "../game/GamesPanel";
import AccountPanel from "../user/AcountPanel";

// Panels (existing)
import AddFriendPanel from "./AddFriendPanel";
import FriendsPanel from "./FriendsPanel";
import PendingRequestsPanel from "./PendingRequestPanel";

// Invites (v2)
import InvitePanelContainer from "../notifications/InvitePanelContainer";
import { createInvite } from "../../api/inviteApi";
import { resolveRecipientUserId } from "../../invites/resolveRecipientUserId";
import { buildInviteLobbyUrl } from "../../invites/InviteNavigation";

import styles from "./FriendsSidebar.module.css";

export default function FriendsSidebar() {
  const navigate = useNavigate();

  const { isSidebarOpen, setDMOpen } = useUI();
  const { friends, pending, acceptRequest, declineRequest, refreshFriends } =
    useFriends();
  const { openChat } = useDirectMessage();
  const { isLoggedIn, user } = useUserContext();

  // ✅ New Code
  const { logout } = useAuth();
  const { createNewGame } = useGameCreation();

  // Step 1: Refresh friends on mount
  useEffect(() => {
    refreshFriends();
  }, [refreshFriends]);

  // ✅ New Code: Game actions (moved from navbar)
  const startMultiplayerGame = useCallback(async () => {
    try {
      const newGame = await createNewGame(user?.first_name || "Player", false);
      if (newGame) navigate(`/lobby/${newGame.id}`);
    } catch (err) {
      console.error("Multiplayer error:", err);
    }
  }, [createNewGame, navigate, user?.first_name]);

  const startAIGame = useCallback(async () => {
    try {
      const newGame = await createNewGame(user?.first_name || "Player", true);
      if (newGame) navigate(`/games/${newGame.id}`);
    } catch (err) {
      console.error("AI game error:", err);
    }
  }, [createNewGame, navigate, user?.first_name]);

  const goHome = useCallback(() => {
    navigate("/");
  }, [navigate]);

  // Step 2: Open chat (only if online)
  const handleFriendClick = useCallback(
    (friend) => {
      if (friend?.friend_status === "online") {
        openChat(friend);
        setDMOpen(true);
      }
    },
    [openChat, setDMOpen]
  );

  // Step 3: Invite v2 (server-authoritative)
  const handleInvite = useCallback(
    async (friend) => {
      try {
        const recipientUserId = resolveRecipientUserId(friend, user?.id);

        if (!recipientUserId) {
          console.error("Invite v2: Could not resolve recipient user id", {
            currentUserId: user?.id,
            friend,
          });
          return;
        }

        if (Number(recipientUserId) === Number(user?.id)) {
          console.warn("Invite v2: Self-invite prevented (frontend)", {
            currentUserId: user?.id,
            recipientUserId,
          });
          return;
        }

        const result = await createInvite({
          toUserId: recipientUserId,
          gameType: "tic_tac_toe",
        });

        const lobbyId = result?.lobbyId;
        const inviteId = result?.invite?.inviteId;

        if (!lobbyId || !inviteId) {
          console.warn(
            "Invite v2: Missing lobbyId or inviteId in response:",
            result
          );
          return;
        }

        navigate(buildInviteLobbyUrl({ lobbyId, inviteId }));
      } catch (error) {
        console.error("Invite v2: Failed to create invite:", error);
      }
    },
    [navigate, user?.id]
  );

  // Step 4: Pending request accept/decline
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

  // ✅ New Code: Account actions
  const handleLogin = useCallback(() => navigate("/login"), [navigate]);
  const handleProfile = useCallback(() => navigate("/profile"), [navigate]);
  const handleAbout = useCallback(() => navigate("/technical-paper"), [navigate]);

  return (
    <div className={`${styles.friendsSidebar} ${isSidebarOpen ? styles.open : ""}`}>
      <div className="px-4 pb-4 pt-2 space-y-4">
        {/* ✅ New Code: Games (top) */}
        <GamesPanel
          isLoggedIn={isLoggedIn}
          onGoHome={goHome}
          onStartMultiplayer={startMultiplayerGame}
          onStartAI={startAIGame}
        />

        {/* Social stack (existing) */}
        <AddFriendPanel />
        <InvitePanelContainer />

        <FriendsPanel
          friends={friends}
          user={user}
          onFriendClick={handleFriendClick}
          onInvite={handleInvite}
        />

        <PendingRequestsPanel
          requests={pendingReceived}
          onAccept={handleAccept}
          onDecline={handleDecline}
        />

        {/* ✅ New Code: Account (bottom) */}
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

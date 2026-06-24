import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useConnectFourMP } from "./hooks/useConnectFourMP";
import { connectFourApi } from "../../api/connectFourApi";
import ConnectFourBoard from "./ConnectFourBoard";
import ConnectFourStatusBar from "./ConnectFourStatusBar";
import ConnectFourResultModal from "./ConnectFourResultModal";
import { showToast } from "../../utils/toast/Toast";

function CopyLinkBox({ gameId }) {
  const link = `${window.location.origin}/games/connect-four/${gameId}`;
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="w-full max-w-[min(92vw,480px)] mx-auto">
      <p className="text-xs text-slate-400/70 mb-2 text-center">
        Share this link with a friend to play
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          value={link}
          className="
            flex-1 rounded-xl px-3 py-2 text-xs
            bg-slate-900/60 border border-slate-700/50
            text-slate-300/80 focus:outline-none
          "
        />
        <button
          type="button"
          onClick={copy}
          className="
            px-3 py-2 rounded-xl text-xs font-semibold
            border border-[#1DA1F2]/30 bg-[#1DA1F2]/10 text-[#1DA1F2]/90
            hover:bg-[#1DA1F2]/20 transition focus:outline-none whitespace-nowrap
          "
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

export default function ConnectFourMPPage() {
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const { state, dropColumn } = useConnectFourMP(gameId);
  const {
    board, currentTurn, winner, winCells,
    myPiece, status, isCompleted,
  } = state;

  // Auto-join when landing on a game we didn't create
  useEffect(() => {
    if (!gameId || !myPiece) return;
    // myPiece null means we haven't loaded yet; null === not a participant → try to join
  }, [gameId, myPiece]);

  useEffect(() => {
    if (status !== "loading") return;
    // After game loads, if myPiece is null we're a new visitor → join
    if (state.myPiece === null && status !== "error") {
      connectFourApi.joinGame(gameId).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handlePlayAgain = useCallback(() => {
    connectFourApi.createGame(false)
      .then((g) => navigate(`/games/connect-four/${g.id}`))
      .catch(() => showToast("error", "Could not create new game."));
  }, [navigate]);

  const isGameOver = isCompleted || status === "won" || status === "draw";

  return (
    <div className="w-full px-4 pt-6 pb-24">
      <div className="mx-auto max-w-lg flex flex-col items-center gap-5">
        {/* Header */}
        <div className="w-full">
          <div className="text-[11px] tracking-[0.28em] text-slate-400/70 uppercase">
            Multiplayer
          </div>
          <h1 className="text-2xl font-semibold text-slate-100/90 tracking-wide">
            Connect Four
          </h1>
        </div>

        {status === "loading" && (
          <div className="text-slate-400/70 text-sm py-8">Loading game…</div>
        )}

        {status === "error" && (
          <div className="text-red-400/80 text-sm py-4">{state.errorMsg}</div>
        )}

        {status !== "loading" && status !== "error" && (
          <>
            <ConnectFourStatusBar
              status={status}
              currentTurn={currentTurn}
              myPiece={myPiece}
              winner={winner}
              p1Name="Player 1"
              p2Name="Player 2"
              isAI={false}
            />

            {status === "waiting" && <CopyLinkBox gameId={gameId} />}

            {board && (
              <ConnectFourBoard
                board={board}
                winCells={winCells}
                myPiece={myPiece}
                currentTurn={currentTurn}
                isGameOver={isGameOver}
                isDisabled={isGameOver || status === "waiting"}
                lastDrop={null}
                onColumnClick={dropColumn}
              />
            )}
          </>
        )}
      </div>

      <ConnectFourResultModal
        status={status}
        winner={winner}
        myPiece={myPiece}
        p1Name="Player 1"
        p2Name="Player 2"
        isAI={false}
        onPlayAgain={handlePlayAgain}
      />
    </div>
  );
}

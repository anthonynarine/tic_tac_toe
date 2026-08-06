import React, { useCallback } from "react";
import { useParams } from "react-router-dom";
import { useConnectFourMP } from "./hooks/useConnectFourMP";
import ConnectFourBoard from "./ConnectFourBoard";
import ConnectFourStatusBar from "./ConnectFourStatusBar";
import ConnectFourResultModal from "./ConnectFourResultModal";

export default function ConnectFourMPPage() {
  const { id: gameId } = useParams();
  const {
    state,
    dropColumn,
    requestRematch,
    acceptRematch,
    declineRematch,
  } = useConnectFourMP(gameId);
  const {
    board, currentTurn, winner, winCells,
    myPiece, status, isCompleted, wsStatus,
    playerOneName, playerTwoName,
    rematchMessage, rematchShowActions, rematchPending, rematchButtonLocked,
  } = state;

  const handlePlayAgain = useCallback(() => {
    requestRematch();
  }, [requestRematch]);

  const isGameOver = isCompleted || status === "won" || status === "draw";

  return (
    <div className="w-full px-1 sm:px-4 pt-1 sm:pt-6 pb-20 sm:pb-24 md:pb-4 min-h-[calc(100dvh-180px)] sm:min-h-[620px] md:min-h-0 md:h-full flex flex-col">
      {/* Header - always visible, normal top-of-flow position */}
      <div className="w-full max-w-2xl mx-auto shrink-0 mb-3 sm:mb-5">
        <div className="hidden text-[11px] tracking-[0.28em] text-text-muted uppercase sm:block">
          Multiplayer
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-wide">
          Connect Four
        </h1>
        <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-text-faint">
          Game WS: {wsStatus === "connected" ? "LIVE" : wsStatus}
        </div>
      </div>

      {/* Board section - centered within remaining space below header */}
      <div className="w-full max-w-2xl mx-auto flex-1 min-h-0 flex flex-col items-center justify-center gap-3 sm:gap-5">
        {status === "loading" && (
          <div className="text-text-secondary text-sm py-8">Loading game…</div>
        )}

        {status === "error" && (
          <div className="text-brand-rose text-sm py-4">{state.errorMsg}</div>
        )}

        {status !== "loading" && status !== "error" && (
          <>
            <ConnectFourStatusBar
              status={status}
              currentTurn={currentTurn}
              myPiece={myPiece}
              winner={winner}
              p1Name={playerOneName}
              p2Name={playerTwoName}
              isAI={false}
            />

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

            <div className="w-full min-h-[76px] sm:min-h-[96px] flex items-start justify-center">
              <ConnectFourResultModal
                status={status}
                winner={winner}
                myPiece={myPiece}
                p1Name={playerOneName}
                p2Name={playerTwoName}
                isAI={false}
                onPlayAgain={handlePlayAgain}
                rematchMessage={rematchMessage}
                rematchShowActions={rematchShowActions}
                rematchPending={rematchPending}
                rematchButtonLocked={rematchButtonLocked}
                onAcceptRematch={acceptRematch}
                onDeclineRematch={declineRematch}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

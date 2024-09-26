import "./Game.css";
import { ResultModal } from "../reslutModal/ResultModal";
import { Board } from "../board/Board";
import { useState } from "react";
import { calculateWinner } from "../../utils/WinnerCalculator";
import  useGameServices  from "../hooks/useGameServices"

const Game = ({ gameId }) => {
  const { gameData, makeMove, loading, error } = useGameServices(gameId);

  const handleCellClick = (position) => {
    if (!loading && !gameData.winner && gameData.board_state[position] === "_") {
      makeMove(position); // Send the move to the backend
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error loading game: {error.message}</div>;
  }

  return (
    <div>
      <h1>Tic-Tac-Toe</h1>
      <Board
        boardState={gameData.board_state}
        onCellClick={handleCellClick}
      />
      <ResultModal winner={gameData.winner} />
    </div>
  )

};

export default Game;
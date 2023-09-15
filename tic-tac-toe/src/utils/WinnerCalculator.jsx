const winningMatrix = {
  0: [[1, 2],[3, 6],[4, 8],],
  1: [[0, 2],[4, 7],],
  2: [[0, 1],[5, 8],[4, 6],],
  3: [[0, 6],[4, 5],],
  4: [[2, 6],[3, 5],[1, 7],[0, 8],],
  5: [[3, 4],[2, 8],],
  6: [[7, 8],[0, 3],[2, 4],],
  7: [[6, 8],[1, 4],],
  8: [[6, 7],[2, 5],[0, 4],],
};

export const calculateWinner = (cellValues, numberOfTurnsLeft, cellIndex) => {
  const currentPlayer = cellValues[cellIndex];

  // Fetch all possible winning combinations for the current cell.
  const potentialWins = winningMatrix[cellIndex];

  // Loop through each of these possible combinations.
  for (const [firstCell, secondCell] of potentialWins) {
    // Check if all cells in the current combination have the same value as the current player.
    if (
      cellValues[firstCell] === currentPlayer &&
      cellValues[secondCell] === currentPlayer
    ) {
      console.log("Winning combination:", [cellIndex, firstCell, secondCell]); // Logging the winning combination

      // If they do, this means the player has achieved a win.
      return {
        hasResult: true,
        winner: currentPlayer,
        winningCombination: [cellIndex, firstCell, secondCell],
      };
    }
  }

  if (numberOfTurnsLeft === 0) {
    return {
      hasResult: true,
      winner: undefined,
      winningCombination: [],
    };
  }

  // If no winning combination is found for the current cell, then return no result.
  return {
    hasResult: false,
    winner: undefined,
    winningCombination: [],
  };
};

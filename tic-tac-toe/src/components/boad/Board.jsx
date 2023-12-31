import "./Board.css";
import { Cell } from "../cell/Cell";

export const Board = ({ cellValues, winningCombination, cellClicked }) => {


  return (
    <div id="board">
      {cellValues.map((value, index) => {
        const canHighlight = winningCombination.indexOf(index) >= 0;
        return (
          <Cell
            key={index}
            value={value}
            canHighlight={canHighlight}
            onClick={() => cellClicked(index)}
          />
        );
      })}
    </div>
  );
};

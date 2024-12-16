import "./Board.css";
import { Cell } from "../cell/Cell";

export const Board = ({ cellValues, winningCombination, cellClicked, isDisabled }) => {
    console.log("Board Props:", { cellClicked, isDisabled });
    return (
        <div id="board">
            {cellValues.map((value, index) => {
                const canHighlight = winningCombination?.indexOf(index) >= 0;
                return (
                    <Cell
                        key={index}
                        value={value}
                        canHighlight={canHighlight}
                        onClick={() => {
                            console.log(`Cell ${index} clicked`);
                            if (!isDisabled) cellClicked(index);
                        }}
                        disabled={isDisabled}
                    />
                );
            })}
        </div>
    );
};

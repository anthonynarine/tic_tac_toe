// Board.jsx
import { useEffect, useRef, useState } from "react";
import "./Board.css";
import { Cell } from "../cell/Cell";

export const Board = ({ cellValues, winningCombination, cellClicked, isDisabled }) => {
    const boardRef = useRef(null);
    const [cellSize, setCellSize] = useState(100); // fallback default

    useEffect(() => {
        const resize = () => {
            if (boardRef.current) {
                const size = Math.min(boardRef.current.offsetWidth, boardRef.current.offsetHeight);
                const paddedSize = size - 32;
                setCellSize(paddedSize / 3);
            }
        };

        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(boardRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div id="board" ref={boardRef}>
            {cellValues.map((value, index) => {
                const canHighlight = winningCombination?.includes(index);
                return (
                    <Cell
                        key={index}
                        value={value}
                        canHighlight={canHighlight}
                        onClick={() => {
                            if (!isDisabled) cellClicked(index);
                        }}
                        disabled={isDisabled}
                        cellSize={cellSize}
                    />
                );
            })}
        </div>
    );
};

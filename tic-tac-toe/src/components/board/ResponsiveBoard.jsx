// components/game/ResponsiveBoard.jsx
import React, { useEffect, useRef, useState } from "react";
import "./ResponsiveBoard.css";

const ResponsiveBoard = () => {
  const boardRef = useRef(null);
  const [cellSize, setCellSize] = useState(100); // fallback default

  useEffect(() => {
    const resize = () => {
      if (boardRef.current) {
        const size = Math.min(boardRef.current.offsetWidth, boardRef.current.offsetHeight);
        const paddedSize = size - 32; // Account for internal padding
        setCellSize(paddedSize / 3);  // 3x3 board
      }
    };

    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(boardRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="board-wrapper" ref={boardRef}>
      {[...Array(9)].map((_, i) => (
        <div
          key={i}
          className="cell"
          style={{
            width: `${cellSize}px`,
            height: `${cellSize}px`,
            fontSize: `${cellSize * 0.4}px`,
          }}
        >
          X
        </div>
      ))}
    </div>
  );
};

export default ResponsiveBoard;

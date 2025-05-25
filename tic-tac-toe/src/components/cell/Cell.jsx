import "./Cell.css";
import classNames from "classnames";

export const Cell = ({ value, canHighlight, onClick, cellSize }) => {
  const cellClasses = classNames({
    cell: true,
    winner: canHighlight,
  });

  let cellContentClasses = "cell-content";
  if (value) {
    cellContentClasses += " populated";
  }

  return (
<button
      className={cellClasses}
      onClick={onClick}
      disabled={!!value}
      data-value={value} 
      style={{
        width: `${cellSize}px`,
        height: `${cellSize}px`,
        fontSize: `${cellSize * 0.55}px`,
        '--accent-color': value === 'X' ? '#ff1a10' : '#00bfff',
      }}
    >
      <span
        className={cellContentClasses}
        data-value={value}
        aria-hidden="true"
      >
        {/* Remove {value} from here */}
      </span>
    </button>
  );
};

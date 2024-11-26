import "./Cell.css";

import classNames from "classnames"


export const Cell = ({ value, canHighlight, onClick }) => {

  console.log("Rendering Cell - Value:", value, "CanHighlight:", canHighlight);

  const cellClasses = classNames({
    cell: true, 
    winner: canHighlight
  });

  let cellContentClasses = "cell-content;"

  if (value) {
    cellContentClasses += " populated";
  }

  return (
    <>
      <button 
        className={cellClasses}
        onClick={onClick}
        disabled={!!value} // Disable the btn if the cell is already populated
        >
        <span className={cellContentClasses}>{value}</span>
      </button>
    </>
  );
};

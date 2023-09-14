import "./Cell.css";

import classNames from "classnames"


export const Cell = ({ value, canHighlight, onClick }) => {

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
      <button className={cellClasses} onClick={onClick}>
        <span className={cellContentClasses}>{value}</span>
      </button>
    </>
  );
};

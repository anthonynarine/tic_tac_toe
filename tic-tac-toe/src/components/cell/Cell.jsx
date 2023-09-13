import "./Cell.css";

export const Cell = ({ value }) => {
  return (
    <>
      <button className="cell">
        <span className="cell-content populated">{value}</span>
      </button>
    </>
  );
};

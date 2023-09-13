import "./Board.css";
import { Cell } from "../cell/Cell";


export const Board = () => {
  return (
    <>
      <div id="board">
        < Cell value="X"/>
        < Cell value="O"/>
        < Cell value="X"/>
        < Cell value="X"/>
        < Cell value="O"/>
        < Cell value="X"/>
        < Cell value="X"/>
        < Cell value="O"/>
        < Cell value="X"/>
       
      </div>
    </>
  );
};

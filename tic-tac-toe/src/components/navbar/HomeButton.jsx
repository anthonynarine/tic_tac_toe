// HomeButton.jsx
import { CiHome } from "react-icons/ci";
import { useNavigate } from "react-router-dom";

const HomeIcon = () => {
    let navigate = useNavigate();

    return(
        <div className="navbar-brand" onClick={() => navigate("/")}>
            <CiHome className="game-icon" />
        </div>
    );
};

export default HomeIcon
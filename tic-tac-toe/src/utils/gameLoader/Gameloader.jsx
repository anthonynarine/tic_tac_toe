import { FaSpinner } from "react-icons/fa"; // Import the spinner icon
import "./GameLoader.css"; 

/**
 * GameLoader Component
 * 
 * Displays a spinner during loading and an error message if there's an error.
 * 
 * Props:
 * - loading (boolean): Indicates if data is being loaded.
 * - error (string|null): Error message to display if an error occurs.
 */
const GameLoader = ({ loading, error }) => {
    if (loading) {
        return (
        <div className="game-loader">
            <FaSpinner className="spinner" /> {/* Animated spinner icon */}
        </div>
        );
    }
    if (error) {
        return <p className="error-message">Error: {error}</p>; // Display error message
    }
    return null;
};

export default GameLoader;

import { useState, useEffect } from  "react"
import useAuthAxios from "./useAuthAxios"

const useGameServices = (gameId) => {
    const { authAxios } = useAuthAxios();
    const [gameData, setGameData] = useState(null) // Game state
    const [loading, setLoading] = useState(true); 
    const [error, setError] = useState(null);

    // Fetch game state from the backend
    const fetchGame = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await authAxios.get(`/games/${gameId}`);
            setGameData(response.data);
            
        } catch (error) {
            console.error("Failed to fetch game:", error);
            setError(error);
        } finally {
            setLoading(false);
        }
    };

    // Make a move in the game 
    const makeMove = async (position) => {
        if (gameData.winner) return; // Prevent making a move if the game is over
        setLoading(true);
        setError(null);

        try {
            const response = await authAxios.put(`/games/${gameId}`, { position });
            setGameData(response.data); // Update game state with the new data
        } catch (error) {
            console.error("Failed to make move:", error);
            setError(error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch game state on component mount or when the gameId changes
    useEffect(() => {
        fetchGame();
    }, [gameId])

    return {
        gameData,
        makeMove,
        fetchGame,
        loading,
        error
    };
};
export default useGameServices;
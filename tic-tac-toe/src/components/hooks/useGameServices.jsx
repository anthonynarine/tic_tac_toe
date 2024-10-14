import { useState, useEffect, useCallback } from "react";
import useAuthAxios from "./useAuthAxios";

const useGameServices = () => {
    const { authAxios } = useAuthAxios();
    const [gameData, setGameData] = useState(null);
    const [joinableGames, setJoinableGames] = useState([]); // For open games
    const [loading, setLoading] = useState(true); 
    const [error, setError] = useState(null);

    // Helper function to extract error message
    const extractErrorMessage = (error) => {
        return error.response?.data?.error || "An error occurred";
    };

    // Helper function to start loading
    const initializeRequest = () => {
        setLoading(true);
        setError(null);
    };

    // Helper function to stop loading
    const stopLoading = () => setLoading(false);

    // Fetch joinable games
    const fetchJoinableGames = useCallback(async () => {
        if (!authAxios) {
            setError("Authorization service unavailable");
            return;
        }

        initializeRequest();
        try {
            const response = await authAxios.get("/games/open-games/");
            setJoinableGames(response.data);
        } catch (error) {
            setError(extractErrorMessage(error));
        } finally {
            stopLoading();
        }
    }, [authAxios]);

    // Fetch user's ongoing games
    const fetchUserGames = useCallback(async () => {
        if (!authAxios) {
            setError("Authorization service unavailable");
            return;
        }

        initializeRequest();
        try {
            const response = await authAxios.get("/games/"); // Assuming /games/ returns user's games
            setGameData(response.data);
        } catch (error) {
            setError(extractErrorMessage(error));
        } finally {
            stopLoading();
        }
    }, [authAxios]);

    // Create a new game
    const createNewGame = useCallback(async (player_o = null, isAIGame = false) => {
        if (!authAxios) {
            setError("Authorization service unavailable");
            return;
        }

        initializeRequest();

        try {
            const payload = {
                is_ai_game: isAIGame, // AI flag o indicate if it's and AI gmae
            };

            const response = await authAxios.post("/games/", payload);
            return response.data; // Return the created game
        } catch (error) {
            setError(extractErrorMessage(error));
        } finally {
            stopLoading();
        }

    },[authAxios])

    return {
        fetchJoinableGames,
        fetchUserGames,
        joinableGames,
        gameData,
        loading,
        error,
    };
};

export default useGameServices;

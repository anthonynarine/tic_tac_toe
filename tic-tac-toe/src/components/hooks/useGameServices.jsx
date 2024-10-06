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

    // Fetch joinable games
    const fetchJoinableGames = useCallback(async () => {
        if (!authAxios) {
            setError("Authorization service unavailable");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await authAxios.get("/games/open-games/");
            setJoinableGames(response.data);
        } catch (error) {
            setError(extractErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }, [authAxios]);

    // Fetch user's ongoing games
    const fetchUserGames = useCallback(async () => {
        if (!authAxios) {
            setError("Authorization service unavailable");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await authAxios.get("/games/"); // Assuming /games/ returns user's games
            setGameData(response.data);
        } catch (error) {
            setError(extractErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }, [authAxios]);

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

import { useState, useCallback } from "react";
import { createNewGameService } from "../../../services/CreateGameService";
import { showToast } from "../../../utils/toast/Toast";
import { extractErrorMessage } from "../../../utils/error/Error";
import useAuthAxios from "../../auth/hooks/useAuthAxios"

/**
 * @param {object} authAxios - An axios instance with the auth headers.
 * @returns {object} An object with "createNewGame", "loading", and "error".
 */
const useGameCreation = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { authAxios } = useAuthAxios();
    // console.log("authAxios:", authAxios);

    const createNewGame = useCallback(
        async (isAIGame = false) => {
            if (!authAxios) {
                setError("Authorization service unavailable");
                return;
            }

            setLoading(true);
            try {
                // Call the service to create a new game
                const newGame = await createNewGameService(authAxios, isAIGame);
                console.log("🎮 Game created:", newGame);
                return newGame;
            } catch (error) {
                // Pass the error object to extractErrorMessage
                const errorMsg = extractErrorMessage(error);
                showToast("Error", errorMsg);
                throw error;
            } finally {
                setLoading(false);
            }
        },
        [authAxios]
    );
    return { createNewGame, loading, error };
};

export default useGameCreation;

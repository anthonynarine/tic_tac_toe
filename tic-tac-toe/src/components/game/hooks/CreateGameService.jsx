/**
 * Create a new game via a backend API
 * 
 * @param {Object} authAxios - An axios instance that includes authorization.
 * @param {boolean} isAIGame - Flag to specify if the game is against AI.
 * @returns {Promise<Object>} The created game data.
 * @throws Will throw an error if the request fails.
 */
export const createNewGameService = async (authAxios, isAIGame) => {
    if (!authAxios) {
        throw new Error("Authorization service unavailable");
    }

    // Construct the payload with the is_ai_game flag
    const payload = {
        is_ai_game: isAIGame,
    };

    // Send POST request to create a new game
    const response = await authAxios.post("/games/", payload);
    return response.data;
};

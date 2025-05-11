
def minimax(board_state_copy, depth, is_maximizing, player_marker, ai_marker):
    """
    Minimax algorithm to calculate the best move for the AI.
    
    Args:
        board_state_copy (list): The current simulated board state as a list of characters.
        depth (int): The current depth of the recursion tree.
        is_maximizing (bool): Whether the AI is trying to maximize its advantage.
        player_marker (str): The human player's marker ('X' or 'O').
        ai_marker (str): The AI's marker ('X' or 'O').
    
    Returns:
        int: The score of the move at the current state.
    """
    # Helper function to check for a winner in the simulated board state
    def check_winner_simulated(board_state):
        winning_combinations = [
            (0, 1, 2), (3, 4, 5), (6, 7, 8),  # rows
            (0, 3, 6), (1, 4, 7), (2, 5, 8),  # columns
            (0, 4, 8), (2, 4, 6)              # diagonals
        ]
        for combo in winning_combinations:
            if board_state[combo[0]] == board_state[combo[1]] == board_state[combo[2]] and board_state[combo[0]] != '_':
                return board_state[combo[0]]
        if "_" not in board_state:
            return "D"  # Draw
        return None  # No winner yet

    # Check the simulated board state for terminal conditions
    winner = check_winner_simulated(board_state_copy)
    if winner == ai_marker:
        return 10 - depth  # Positive score if AI wins
    elif winner == player_marker:
        return depth - 10  # Negative score if human wins
    elif winner == "D":
        return 0  # Draw

    # Minimax logic
    if is_maximizing:
        best_score = float('-inf')
        for i in range(9):
            if board_state_copy[i] == '_':  # Check empty cell
                # Simulate AI move
                board_state_copy[i] = ai_marker
                score = minimax(board_state_copy, depth + 1, False, player_marker, ai_marker)
                best_score = max(best_score, score)
                # Revert move after simulation
                board_state_copy[i] = '_'
        return best_score
    else:
        best_score = float('inf')
        for i in range(9):
            if board_state_copy[i] == '_':  # Check empty cell
                # Simulate player move
                board_state_copy[i] = player_marker
                score = minimax(board_state_copy, depth + 1, True, player_marker, ai_marker)
                best_score = min(best_score, score)
                # Revert move after simulation
                board_state_copy[i] = '_'
        return best_score


def get_best_move(game_instance, player_marker, ai_marker):
    """
    Calculate the best move for the AI using the Minimax algorithm.

    Args:
        game_instance (TicTacToeGame): The current game instance.
        player_marker (str): The human player's marker ('X' or 'O').
        ai_marker (str): The AI's marker ('X' or 'O').

    Returns:
        int: The index of the best move for the AI.
    """
    best_score = float('-inf')
    best_move = None

    # Copy the board state to simulate moves
    board_state_copy = list(game_instance.board_state)

    for i in range(9):
        if board_state_copy[i] == '_':  # Check if cell is empty
            # Simulate AI move
            board_state_copy[i] = ai_marker
            score = minimax(board_state_copy, 0, False, player_marker, ai_marker)
            # Revert move after simulation
            board_state_copy[i] = '_'

            # Keep track of the best move
            if score > best_score:
                best_score = score
                best_move = i

    return best_move


def get_best_move(game_instance, player_marker, ai_marker):
    """
    Calculate the best move for the AI using the Minimax algorithm.

    Args:
        game_instance (TicTacToeGame): The current game instance.
        player_marker (str): The human player's marker ('X' or 'O').
        ai_marker (str): The AI's marker ('X' or 'O').

    Returns:
        int: The index of the best move for the AI.
    """
    best_score = float('-inf')
    best_move = None

    # Copy the board state to simulate moves
    board_state_copy = list(game_instance.board_state)

    for i in range(9):
        if board_state_copy[i] == '_':  # Check if cell is empty
            # Simulate AI move
            board_state_copy[i] = ai_marker
            score = minimax(board_state_copy, 0, False, player_marker, ai_marker)
            # Revert move after simulation
            board_state_copy[i] = '_'

            # Keep track of the best move
            if score > best_score:
                best_score = score
                best_move = i

    return best_move

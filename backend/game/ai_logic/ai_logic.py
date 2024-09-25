from game.models import TicTacToeGame

def minimax(game_instance, depth, is_maximizing, player_marker, ai_marker):
    """
    Minimax algorithm to calculate the best move for the AI.
    
    Args:
        game_instance (TicTacToeGame): The current game instance.
        depth (int): The current depth of the recursion tree.
        is_maximizing (bool): Whether the AI is trying to maximize its advantage.
        player_marker (str): The human player's marker ('X' or 'O').
        ai_marker (str): The AI's marker ('X' or 'O').
    
    Returns:
        int: The score or position of the best move.
    """
    # Clone the board state so the model instance isn't modified
    board_state_copy = list(game_instance.board_state)

    # Check if the game already has a winner or is a draw
    game_instance.board_state = ''.join(board_state_copy)  # Restore the board for simulation
    game_instance.check_winner()  # Recheck winner status
    
    # Return appropriate scores for terminal states
    if game_instance.winner == ai_marker:
        return 10 - depth  # Positive score if AI wins
    elif game_instance.winner == player_marker:
        return depth - 10  # Negative score if human wins
    elif game_instance.winner == "D":
        return 0  # Draw

    # Maximizing turn for AI
    if is_maximizing:
        best_score = float('-inf')
        for i in range(9):
            if board_state_copy[i] == '_':
                # Simulate AI move
                board_state_copy[i] = ai_marker
                game_instance.board_state = ''.join(board_state_copy)

                score = minimax(game_instance, depth + 1, False, player_marker, ai_marker)
                best_score = max(best_score, score)

                # Revert move after simulation
                board_state_copy[i] = '_'
        return best_score

    # Minimizing turn for player
    else:
        best_score = float('inf')
        for i in range(9):
            if board_state_copy[i] == '_':
                # Simulate player move
                board_state_copy[i] = player_marker
                game_instance.board_state = ''.join(board_state_copy)

                score = minimax(game_instance, depth + 1, True, player_marker, ai_marker)
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
        if board_state_copy[i] == '_':
            # Simulate AI move
            board_state_copy[i] = ai_marker
            game_instance.board_state = ''.join(board_state_copy)

            score = minimax(game_instance, 0, False, player_marker, ai_marker)
            if score > best_score:
                best_score = score
                best_move = i

            # Revert move after simulation
            board_state_copy[i] = '_'

    return best_move

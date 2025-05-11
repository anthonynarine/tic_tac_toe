import random

def minimax(board_state_copy, depth, is_maximizing, player_marker, ai_marker, max_depth=3):
    """
    Minimax algorithm with depth limit and imperfect play for medium difficulty.

    Args:
        board_state_copy (list): Simulated board.
        depth (int): Current depth in recursion.
        is_maximizing (bool): Whether AI is maximizing.
        player_marker (str): Human's marker.
        ai_marker (str): AI's marker.
        max_depth (int): Max depth for recursion (limits AI foresight).

    Returns:
        int: Score of the move.
    """

    def check_winner_simulated(board_state):
        winning_combinations = [
            (0, 1, 2), (3, 4, 5), (6, 7, 8),
            (0, 3, 6), (1, 4, 7), (2, 5, 8),
            (0, 4, 8), (2, 4, 6)
        ]
        for combo in winning_combinations:
            if board_state[combo[0]] == board_state[combo[1]] == board_state[combo[2]] and board_state[combo[0]] != '_':
                return board_state[combo[0]]
        if '_' not in board_state:
            return "D"
        return None

    winner = check_winner_simulated(board_state_copy)
    if winner == ai_marker:
        return 10 - depth
    elif winner == player_marker:
        return depth - 10
    elif winner == "D":
        return 0

    # Step 1: Limit foresight to max_depth
    if depth >= max_depth:
        return 0  # treat unknown future as neutral

    if is_maximizing:
        best_score = float('-inf')
        for i in range(9):
            if board_state_copy[i] == '_':
                board_state_copy[i] = ai_marker
                score = minimax(board_state_copy, depth + 1, False, player_marker, ai_marker, max_depth)
                board_state_copy[i] = '_'
                best_score = max(best_score, score)
        return best_score
    else:
        best_score = float('inf')
        for i in range(9):
            if board_state_copy[i] == '_':
                board_state_copy[i] = player_marker
                score = minimax(board_state_copy, depth + 1, True, player_marker, ai_marker, max_depth)
                board_state_copy[i] = '_'
                best_score = min(best_score, score)
        return best_score


def get_best_move(game_instance, player_marker, ai_marker, randomness=0.2):
    """
    Get best move for AI with some randomness to simulate medium difficulty.

    Args:
        game_instance (TicTacToeGame): Game object.
        player_marker (str): Human marker.
        ai_marker (str): AI marker.
        randomness (float): Probability of choosing a suboptimal move.

    Returns:
        int: Selected move index.
    """
    board_state_copy = list(game_instance.board_state)
    move_scores = []

    for i in range(9):
        if board_state_copy[i] == '_':
            board_state_copy[i] = ai_marker
            score = minimax(board_state_copy, 0, False, player_marker, ai_marker, max_depth=3)
            board_state_copy[i] = '_'
            move_scores.append((i, score))

    # Step 2: Sort moves by score descending
    move_scores.sort(key=lambda x: x[1], reverse=True)

    # Step 3: Occasionally pick a suboptimal move
    if random.random() < randomness and len(move_scores) > 1:
        return random.choice(move_scores[1:])[0]  # Not the best, but still decent

    return move_scores[0][0]

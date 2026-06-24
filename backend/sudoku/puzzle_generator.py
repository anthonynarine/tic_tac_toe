import random

CLUE_COUNTS = {
    "easy": 36,
    "medium": 27,
    "hard": 22,
    "expert": 17,
}


def _is_valid(board, row, col, num):
    if num in board[row]:
        return False
    if num in (board[r][col] for r in range(9)):
        return False
    box_r, box_c = (row // 3) * 3, (col // 3) * 3
    for r in range(box_r, box_r + 3):
        for c in range(box_c, box_c + 3):
            if board[r][c] == num:
                return False
    return True


def _fill(board):
    for row in range(9):
        for col in range(9):
            if board[row][col] == 0:
                nums = list(range(1, 10))
                random.shuffle(nums)
                for num in nums:
                    if _is_valid(board, row, col, num):
                        board[row][col] = num
                        if _fill(board):
                            return True
                        board[row][col] = 0
                return False
    return True


def _count_solutions(board, limit=2):
    count = [0]

    def solve(b):
        if count[0] >= limit:
            return
        for row in range(9):
            for col in range(9):
                if b[row][col] == 0:
                    for num in range(1, 10):
                        if _is_valid(b, row, col, num):
                            b[row][col] = num
                            solve(b)
                            b[row][col] = 0
                    return
        count[0] += 1

    solve([row[:] for row in board])
    return count[0]


def generate_puzzle(difficulty="medium"):
    solution = [[0] * 9 for _ in range(9)]
    _fill(solution)

    puzzle = [row[:] for row in solution]
    clues_needed = CLUE_COUNTS.get(difficulty, CLUE_COUNTS["medium"])
    cells_to_remove = 81 - clues_needed

    positions = list(range(81))
    random.shuffle(positions)

    removed = 0
    for pos in positions:
        if removed >= cells_to_remove:
            break
        row, col = divmod(pos, 9)
        backup = puzzle[row][col]
        puzzle[row][col] = 0

        if _count_solutions(puzzle) == 1:
            removed += 1
        else:
            puzzle[row][col] = backup

    puzzle_str = "".join(str(puzzle[r][c]) for r in range(9) for c in range(9))
    solution_str = "".join(str(solution[r][c]) for r in range(9) for c in range(9))
    return puzzle_str, solution_str

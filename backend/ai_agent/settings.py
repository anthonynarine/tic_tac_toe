
import os
from pathlib import Path
from django.conf import settings


# Step 1: Resolve project root (Heroku + local compatible)
if settings.DEBUG:
    PROJECT_ROOT = Path(__file__).parents[2].resolve()
else:
    PROJECT_ROOT = Path(__file__).resolve().parent.parent


# Step 2: Env config
INDEX_DIR = Path(
    os.getenv("AI_AGENT_INDEX_DIR", PROJECT_ROOT / "ai_agent_index")
).resolve()

REBUILD_INDEX = os.getenv("AI_AGENT_REBUILD_INDEX") == "1"


# Step 3: Target directories (must include invites/)
if settings.DEBUG:
    TARGET_DIRS = [
        PROJECT_ROOT / "backend" / "ai_agent",
        PROJECT_ROOT / "backend" / "chat",
        PROJECT_ROOT / "backend" / "friends",
        PROJECT_ROOT / "backend" / "invites",
        PROJECT_ROOT / "backend" / "game",
        PROJECT_ROOT / "backend" / "users",
        PROJECT_ROOT / "backend" / "utils",
        PROJECT_ROOT / "tic-tac-toe" / "src",
    ]
else:
    TARGET_DIRS = [
        PROJECT_ROOT / "ai_agent",
        PROJECT_ROOT / "chat",
        PROJECT_ROOT / "friends",
        PROJECT_ROOT / "invites",
        PROJECT_ROOT / "game",
        PROJECT_ROOT / "users",
        PROJECT_ROOT / "utils",
    ]


# Step 4: Filters
EXCLUDE_DIRS = {
    "migrations", "__pycache__", "static", "media",
    "node_modules", "build", ".git", ".vscode",
}
EXCLUDE_FILES = {
    "settings.py", "secrets.py", ".env", "manage.py",
}
VALID_EXTENSIONS = {".py", ".md", ".txt", ".js", ".jsx", ".ts", ".tsx"}

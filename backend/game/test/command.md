# Make sure PYTHONPATH includes 'backend'
$env:PYTHONPATH = "backend"              # For PowerShell
# or
set PYTHONPATH=backend                   # For CMD

# Then run the test file:
pytest backend/game/test/test_redis_game_lobby_manager.py
pytest backend/game/test/test_redis_chat_lobby_manager.py

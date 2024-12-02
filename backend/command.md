# Command starts a Uvicorn server for a Django ASGI application.
uvicorn ttt_core.asgi:application --port 8000 --workers 4 --log-level debug --reload

# Command to start the rabbitmq consumer in account app
1. Navigate to the backend dir:
    cd D:\react-django\Speakez\backend
2. python manage.py shell
3. from account.rabbitmq_consumer import start_consumer
4. start_consumer()

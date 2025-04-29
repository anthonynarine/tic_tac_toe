# Command starts a Uvicorn server for a Django ASGI application.
uvicorn ttt_core.asgi:application --port 8000 --workers 4 --log-level debug --reload

# Debug testing
uvicorn ttt_core.asgi:application --host 127.0.0.1 --port 8000 --reload --log-level debug


# Command to start the rabbitmq consumer in account app
1. Navigate to the backend dir:
    cd D:\react-django\Speakez\backend
2. python manage.py shell
3. from account.rabbitmq_consumer import start_consumer
4. start_consumer()

 # Production
 login to admin
 heroku run python manage.py createsuperuser --app tic-tac-toe-server
https://tic-tac-toe-server-66c5e15cb1f1.herokuapp.com/admin/

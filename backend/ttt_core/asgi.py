
import os
import logging

# Configure logging for the ASGI server
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Set the environment variable for Django settings
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ttt_core.settings")
logger.debug(f"DJANGO_SETTINGS_MODULE: {os.environ.get('DJANGO_SETTINGS_MODULE')}")

# Import Django's WSGI application and wrap it for ASGI
from asgiref.wsgi import WsgiToAsgi
from django.core.wsgi import get_wsgi_application

# Wrap WSGI app for ASGI-compatible HTTP interface
django_wsgi_app = get_wsgi_application()
django_asgi_app = WsgiToAsgi(django_wsgi_app)

# Import WebSocket middleware and routing
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from game.middleware import JWTWebSocketMiddleware
import game.routing
import chat.routing

# Define ASGI application with HTTP and WebSocket support
application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        JWTWebSocketMiddleware(
            URLRouter(
                game.routing.websocket_urlpatterns + chat.routing.websocket_urlpatterns
            )
        )
    ),
})

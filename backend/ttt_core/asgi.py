import os
import logging

# Configure logging for the ASGI server
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Set the environment variable for Django settings
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ttt_core.settings")
logger.debug(f"DJANGO_SETTINGS_MODULE: {os.environ.get('DJANGO_SETTINGS_MODULE')}")

# Import Django's ASGI application handler
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

# Initialize the Django ASGI application early to ensure apps are loaded
django_asgi_app = get_asgi_application()

# Import WebSocket middleware and routing after Django initialization
from game.middleware import JWTWebSocketMiddleware
import game.routing

# Define the ASGI application with support for HTTP and WebSocket protocols
application = ProtocolTypeRouter({
    # Route HTTP traffic to Django's ASGI application
    "http": django_asgi_app,

    # Route WebSocket traffic through middleware and URL routing
    "websocket": AllowedHostsOriginValidator(  # Ensure WebSocket requests originate from allowed hosts
        JWTWebSocketMiddleware(  # Add custom middleware to handle JWT authentication
            URLRouter(game.routing.websocket_urlpatterns)  # Define WebSocket routes
        )
    ),
})

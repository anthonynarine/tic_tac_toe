import os
import logging
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
from game.middleware import JWTWebSocketMiddleware

logger = logging.getLogger(__name__)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ttt_core.settings")

django_asgi_application = get_asgi_application()

# import websocket routing
import game.routing

application = ProtocolTypeRouter(
    {
        # Route HTTP requests to Django's ASGI application handler
        "http": django_asgi_application,
        
        "websocket": URLRouter(
            game.routing.websocket_urlpatterns
        ), 
    })

logger.info("ASGI application loaded successfully")
# Filename: backend/ttt_core/asgi.py

import os
import logging

# Configure logging for the ASGI server
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Set the environment variable for Django settings
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ttt_core.settings")
logger.debug(f"DJANGO_SETTINGS_MODULE: {os.environ.get('DJANGO_SETTINGS_MODULE')}")

from asgiref.wsgi import WsgiToAsgi
from django.core.wsgi import get_wsgi_application

django_wsgi_app = get_wsgi_application()
django_asgi_app = WsgiToAsgi(django_wsgi_app)

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from ttt_core.middleware import JWTWebSocketMiddleware

import game.routing
import chat.routing
import friends.routing
import notifications.routing
import lobby.routing 

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        JWTWebSocketMiddleware(
            URLRouter(
                notifications.routing.websocket_urlpatterns
                + lobby.routing.websocket_urlpatterns   
                + game.routing.websocket_urlpatterns
                + chat.routing.websocket_urlpatterns
                + friends.routing.websocket_urlpatterns
            )
        )
    ),
})

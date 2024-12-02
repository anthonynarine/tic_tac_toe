import os
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ttt_core.settings")

django_application = get_asgi_application()
from .import urls

application = ProtocolTypeRouter(
    {
        # Route HTTP requests to Django's ASGI application handler
        "http": django_application,
        # "websocket": URLRouter(urls.websocket_urlpatterns),
        
    }
)


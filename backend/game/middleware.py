import logging
from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()
logger = logging.getLogger(__name__)

@database_sync_to_async
def get_user(user_id: int):
    """
    Retrieve a user from the database using the user ID from the token payload.

    Args:
        user_id (int): The ID of the user.

    Returns:
        User or AnonymousUser: The user object if found; otherwise, AnonymousUser.
    """
    try:
        return User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return AnonymousUser()

class JWTWebSocketMiddleware:
    """
    Middleware for WebSocket connections to handle JWT-based authentication.

    This middleware intercepts WebSocket connection requests and extracts the JWT token from
    the query parameters or headers. It then verifies the token and attaches the authenticated
    user to the WebSocket scope. If the token is invalid or missing, an AnonymousUser is attached.
    """
    
    def __init__(self, app):
        """
        Initialize the middleware.

        Args:
            app (ASGI application): The next ASGI application or middleware in the stack.
        """
        self.app = app
        
    async def __call__(self, scope: dict, receive: callable, send: callable):
        """
        Handle the WebSocket connection and authenticate the user using the JWT token.

        Args:
            scope (dict): The WebSocket connection scope.
            receive (callable): The callable to receive messages.
            send (callable): The callable to send messages.

        Returns:
            awaitable: Calls the next middleware or application in the stack.
        """
        logger.debug("JWTWebSocketMiddleware: Middleware invoked")
        
        # Extract the token from the header or the query parameters
        token = self._get_token_from_scope(scope)
        
        if token:
            try:
                # Decode and validate the JWT token
                access_token = AccessToken(token)
                user_id = access_token["user_id"]
                logger.debug(f"Token decoded successfully, user ID: {user_id}")

                # Fetch the user and attach it to the scope
                scope["user"] = await get_user(user_id)
                logger.info(f"User authenticated successfully: {scope['user']}")
            except Exception as e:
                # Handle invalid or expired tokens
                logger.warning(f"Invalid or expired token: {e}")
                scope["user"] = AnonymousUser()
        else:
            logger.warning("No token found; assigning AnonymousUser.")
            scope["user"] = AnonymousUser()
            
        # Pass control to the next middleware/application
        return await self.app(scope, receive, send)
    
                
    def _get_token_from_scope(self, scope: dict) -> str:
        """
        Extract the JWT token from the WebSocket connection's headers or query parameters.

        This method first checks the WebSocket connection's headers for an 'Authorization' header
        containing a Bearer token. If the token is not found in the headers, it looks for a 'token'
        query parameter in the WebSocket's query string.

        Args:
            scope (dict): The WebSocket connection scope. This includes metadata about the connection,
                        such as headers, query string, and path.

        Returns:
            str or None: The extracted JWT token if found in the headers or query string. If no token
                        is found, returns None.
        """
        # Step 1: Check the headers for an 'Authorization' header
        headers = dict(scope.get("headers", []))  # Extract headers from the scope
        auth_header = headers.get(b"authorization")  # Look for the 'Authorization' header
        if auth_header:
            # Decode the header value and extract the token after "Bearer "
            token = auth_header.decode().split("Bearer ")[-1]
            logger.debug("Token extracted from Authorization header")
            return token

        # Step 2: Check the query string for a 'token' parameter
        query_string = parse_qs(scope.get("query_string", b"").decode())  # Parse query string
        token = query_string.get("token", [None])[0]  # Get the first 'token' parameter value
        if token:
            logger.debug("Token extracted from query string")
        return token  # Return the token or None if not found

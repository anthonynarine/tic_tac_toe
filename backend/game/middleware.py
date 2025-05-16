import logging
from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from django.core.cache import cache

# Initialize logger
logger = logging.getLogger(__name__)

class JWTWebSocketMiddleware:
    """
    Middleware for WebSocket connections to handle JWT-based authentication.

    This middleware intercepts WebSocket connection requests, extracts the JWT token,
    validates the token, and attaches the authenticated user to the WebSocket's scope.
    If the token is missing, invalid, or expired, an AnonymousUser is assigned to the scope.
    """

    def __init__(self, app):
        """
        Initialize the middleware.

        Args:
            app (ASGI application): The next ASGI application or middleware in the stack.
        """
        self.app = app

    async def __call__(self, scope, receive, send):
        """
        Process the WebSocket connection and authenticate the user using the JWT token.

        Steps:
        1. Extract the JWT token from the WebSocket connection's headers or query string.
        2. Decode and validate the token using SimpleJWT.
        3. Retrieve the user from the database or cache using the user ID from the token payload.
        4. Attach the authenticated user to the WebSocket connection's scope.
        5. Assign an AnonymousUser if the token is missing, invalid, or expired.

        Args:
            scope (dict): The WebSocket connection scope, containing metadata about the connection.
            receive (callable): A callable to receive messages from the WebSocket.
            send (callable): A callable to send messages to the WebSocket.

        Returns:
            awaitable: Calls the next middleware or application in the stack.
        """
        logger.debug("JWTWebSocketMiddleware: Middleware invoked")

        # Lazy-load Django imports to avoid accessing models/settings prematurely
        from django.contrib.auth.models import AnonymousUser
        from django.contrib.auth import get_user_model

        # Step 1: Extract token from headers or query string
        token = self._get_token_from_scope(scope)

        if token:
            try:
                # Step 2: Decode and validate the JWT token
                User = get_user_model()  # Fetch the custom user model dynamically
                access_token = AccessToken(token)  # Decode the JWT token
                user_id = access_token["user_id"]  # Extract the user ID from the token payload

                # Step 3: Retrieve the user from cache or database
                cache_key = f"user_{user_id}"
                user = None

                try:
                    user = cache.get(cache_key)
                except TypeError as redis_error:
                    logger.warning(f"⚠️ Redis cache.get() failed: {redis_error} — falling back to DB")

                if not user:
                    user = await self.get_user(user_id, User)  # Fetch user from database

                    try:
                        cache.set(cache_key, user, timeout=60)  # Cache user for 60 seconds
                    except TypeError as redis_error:
                        logger.warning(f"⚠️ Redis cache.set() failed: {redis_error} — skipping cache store")

                # Step 4: Attach the authenticated user to the WebSocket scope
                if user:
                    scope["user"] = user
                    logger.info(f"User authenticated successfully: {scope['user']} (ID: {user_id})")
                else:
                    raise ValueError("User not found.")
            except Exception as e:
                # Step 5: Handle invalid or expired tokens gracefully
                logger.warning(f"Invalid or expired token: {e}")
                scope["user"] = AnonymousUser()
        else:
            # Step 5: Assign AnonymousUser if no token is found
            logger.info("No token found; assigning AnonymousUser.")
            scope["user"] = AnonymousUser()

        # Pass the request to the next middleware or application in the stack
        return await self.app(scope, receive, send)

    @database_sync_to_async
    def get_user(self, user_id, User):
        """
        Retrieve a user from the database asynchronously using the user ID from the token.

        Steps:
        1. Query the database to fetch the user with the given primary key (ID).
        2. Return an AnonymousUser if the user does not exist.

        Args:
            user_id (int): The ID of the user.
            User: The user model (custom or default).

        Returns:
            User or AnonymousUser: The user object if found; otherwise, AnonymousUser.
        """
        from django.contrib.auth.models import AnonymousUser  # Import inside the method
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            logger.warning(f"User with ID {user_id} does not exist.")
            return AnonymousUser()

    def _get_token_from_scope(self, scope):
        """
        Extract the JWT token from the WebSocket connection's headers or query string.

        Steps:
        1. Check the 'Authorization' header in the WebSocket connection's headers.
        2. If the 'Authorization' header is missing, check the query string for a 'token' parameter.
        3. Return the token if found; otherwise, return None.

        Args:
            scope (dict): The WebSocket connection scope, including headers and query string.

        Returns:
            str or None: The extracted JWT token if found; otherwise, None.
        """
        # Step 1: Extract token from the 'Authorization' header
        headers = dict(scope.get("headers", []))  # Get headers from the scope
        auth_header = headers.get(b"authorization")  # Look for the 'Authorization' header
        if auth_header:
            # Decode the header value and extract the token after "Bearer "
            parts = auth_header.decode().split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                logger.debug("Token extracted from Authorization header.")
                return parts[1]

        # Step 2: Extract token from the query string
        query_string = parse_qs(scope.get("query_string", b"").decode())  # Parse query string
        token = query_string.get("token", [None])[0]  # Get the first 'token' parameter value
        if token:
            logger.debug("Token extracted from query string.")
        return token  # Return the token or None if not found

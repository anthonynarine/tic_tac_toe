import logging
from channels.generic.websocket import JsonWebsocketConsumer
from asgiref.sync import async_to_sync
from django.contrib.auth.models import AnonymousUser

# Create logger instance
logger = logging.getLogger(__name__)

class GameLobbyConsumer(JsonWebsocketConsumer):
    """
    WebSocket consumer for managing a game lobby with chat functionality.
    Features:
        - Authenticated connection via middleware.
        - Temporary chat messages that only live in the lobby.
        - Game-related events, such as starting the game.
    """
    
    def connect(self):
        """
        Handle WebSocket connection. Authenticate the user and join the game lobby group.
        """
        # The middleware attaches the authenticated user to the scope
        self.user = self.scope["user"]

        # Debugging scope details
        logger.debug(f"Scope type: {self.scope['type']}")  
        logger.debug(f"Scope path: {self.scope['path']}")  
        
        # Reject the connection if the user is not authenticated
        if isinstance(self.user, AnonymousUser):
            logger.warning("WebSocket connection rejected: Unauthenticated user")
            self.close(code=4001)
            return 
        
        logger.info(f"WebSocket connection accepted for user: {self.user.first_name}")
        self.accept()
        
        # Extract the game ID and create a unique lobby group name
        self.game_id = self.scope["url_route"]["kwargs"]["game_id"]
        self.lobby_group_name = f"game_lobby_{self.game_id}"
        
        # Add the player to the game lobby group
        async_to_sync(self.channel_layer.group_add)(
            self.lobby_group_name,
            self.channel_name
        )
        
        # Notify the player of successful connection
        self.send_json(
            {
                "type": "connection_success",
                "message": f"Welcome to the game lobby, {self.user.first_name}!"
            }
        )
        
        logger.info(f"User {self.user.first_name} joined lobby: {self.lobby_group_name}")
        
    def receive_json(self, content, **kwargs):
        """
        Handle incoming messages from the WebSocket client.
        """
        message_type = content.get("type")
        message = content.get("message", "")
        
        if message_type == "chat_message" and message:
            self.handle_chat_message(message)
        elif message_type == "start_game":
            self.handle_start_game()
        else:
            logger.warning(f"Unknown or invalid message type received: {message_type}")
    
    def handle_chat_message(self, message):
        """
        Handle a chat message and broadcast it to all the players in the lobby.
        """
        sender_name = self.user.first_name
        logger.info(f"Chat message from {sender_name}: {message}")
        
        # Broadcast the message to the group
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "chat_message",
                "message": {
                    "sender": sender_name,
                    "content": message,
                },
            }
        )
        
    def handle_start_game(self):
        """
        Handle the game start event and notify all players in the lobby.
        """
        logger.info(f"Game started in lobby: {self.lobby_group_name}")
        
        # Notify all players in the group
        async_to_sync(self.channel_layer.group_send)(
            self.lobby_group_name,
            {
                "type": "game_start_message",
                "message": f"{self.user.first_name} has started the game!",
            }
        )
        
    def chat_message(self, event):
        """
        Send a chat message event to the WebSocket client.
        """
        message = event.get("message")
        if message:
            logger.info(f"Broadcasting chat message in lobby {self.lobby_group_name}: {message['content']}")
            self.send_json({
                "type": "chat_message",
                "message": message,
            })
    
    def game_start_message(self, event):
        """
        Send a game start event to the WebSocket client.
        """
        logger.info(f"Broadcasting game start message in lobby {self.lobby_group_name}")
        self.send_json({
            "type": "game_start",
            "message": event["message"],
        })
    
    def disconnect(self, code):
        """
        Handle WebSocket disconnection and remove the player from the lobby group.
        """
        if not isinstance(self.user, AnonymousUser):
            logger.info(f"User {self.user.first_name} disconnected from lobby {self.lobby_group_name} with code {code}")
        else:
            logger.info(f"Anonymous user disconnected from lobby {self.lobby_group_name} with code {code}")

        # Remove the player from the lobby group
        async_to_sync(self.channel_layer.group_discard)(
            self.lobby_group_name,
            self.channel_name
        )

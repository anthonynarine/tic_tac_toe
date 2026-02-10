# Filename: backend/chat/consumers.py
import logging
import uuid

from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer

from utils.shared.shared_utils_game_chat import SharedUtils
from utils.chat.chat_utils import ChatUtils  # keep your existing path

logger = logging.getLogger("chat.consumer")

# Step 1: Client->Server message contract for Chat WS only
CHAT_ALLOWED_TYPES = {
    "chat_message",
    # Optional: keepalive hooks if you use them on FE
    # "ping",
}


# Step 1: Client->Server message contract for Chat WS only
CHAT_ALLOWED_TYPES = {
    "chat_message",
    # Optional: keepalive hooks if you use them on FE
    # "ping",
}


class ChatConsumer(JsonWebsocketConsumer):
    """
    Chat WebSocket (message-only)

    Route:
      /ws/chat/lobby/<lobby_name>/?token=...

    Client -> Server:
      - { "type": "chat_message", "message": "<string>" }

    Server -> Client:
      - { "type": "chat_message", "message": { "id": "<uuid>", "sender": "<str>", "content": "<str>" } }
      - { "type": "error", "message": "<str>" }
    """

    def connect(self):
        # Step 1: Auth guard
        self.user = self.scope.get("user")
        if not self.user or getattr(self.user, "is_anonymous", True):
            # keep same behavior pattern you used elsewhere
            self.accept()
            self.close(code=4401)
            return

        # Step 2: Extract lobby name and bind to a CHAT-ONLY group namespace
        lobby_name = self.scope["url_route"]["kwargs"].get("lobby_name")
        if not lobby_name:
            self.accept()
            self.send_json({"type": "error", "message": "Missing lobby_name in URL."})
            self.close(code=4402)
            return

        self.lobby_name = str(lobby_name)

        # Step 2b: Backward-compatible normalization
        # Old frontend versions passed lobby_name="chat_lobby_<id>".
        # We normalize so both old and new clients join the SAME group: chat_lobby_<id>.
        if self.lobby_name.startswith("chat_lobby_"):
            self.lobby_name = self.lobby_name[len("chat_lobby_"):]

        self.chat_group_name = f"chat_lobby_{self.lobby_name}"

        # Step 3: Join chat group + accept
        async_to_sync(self.channel_layer.group_add)(self.chat_group_name, self.channel_name)
        self.accept()

        # Step 4: Optional lightweight ack
        self.send_json({"type": "connection_success", "message": "Connected to lobby chat."})
        logger.info("User %s joined chat group=%s", getattr(self.user, "id", None), self.chat_group_name)

    def receive_json(self, content: dict, **kwargs) -> None:
        """
        Step 1: Validate envelope
        Step 2: Enforce allowed types
        Step 3: Route
        """
        try:
            SharedUtils.validate_message(content)
            msg_type = (content.get("type") or "").strip()

            if msg_type not in CHAT_ALLOWED_TYPES:
                logger.warning("Invalid chat message type=%s content=%s", msg_type, content)
                self.send_json({"type": "error", "message": f"Invalid message type: {msg_type}"})
                # Production-grade: close on protocol violation (matches your prior 4003 symptom)
                self.close(code=4003)
                return

            if msg_type == "chat_message":
                self.handle_chat_message(content)
                return

        except Exception as exc:
            logger.exception("Chat receive_json error: %s", exc)
            self.send_json({"type": "error", "message": "Invalid payload."})

    def handle_chat_message(self, content: dict) -> None:
        """
        Validates and broadcasts chat messages to the lobby chat group.

        Note:
        - We include a stable message.id (uuid) so the frontend can dedupe safely
          at the reducer boundary even if a socket mounts twice.
        """
        try:
            # Step 1: Validate message format (your existing util)
            ChatUtils.validate_message(content)  # expects {type:"chat_message", message:"..."}

            # Step 2: Extract sender + message
            sender_name = getattr(self.user, "first_name", "Unknown")
            text = (content.get("message") or "").strip()

            if not text:
                self.send_json({"type": "error", "message": "Message cannot be empty."})
                return

            if not getattr(self, "chat_group_name", None):
                self.send_json({"type": "error", "message": "Chat group not initialized."})
                return

            # Step 3: Broadcast (explicit id for FE dedupe)
            message_id = str(uuid.uuid4())

            async_to_sync(self.channel_layer.group_send)(
                self.chat_group_name,
                {
                    "type": "chat_message",
                    "message": {
                        "id": message_id,
                        "sender": sender_name,
                        "content": text,
                    },
                },
            )

        except Exception as exc:
            logger.exception("handle_chat_message failed: %s", exc)
            self.send_json({"type": "error", "message": "Failed to send message."})

    def chat_message(self, event: dict) -> None:
        """
        Receives broadcast events from the group and forwards them to the client.
        Expected event:
          { "type": "chat_message", "message": { "id": "<uuid>", "sender": "...", "content": "..." } }
        """
        message = event.get("message")
        if not isinstance(message, dict) or "content" not in message:
            self.send_json({"type": "error", "message": "Invalid message structure."})
            return

        self.send_json({"type": "chat_message", "message": message})

    def disconnect(self, code: int) -> None:
        # Step 1: Only group cleanup (no Redis roster here anymore)
        group = getattr(self, "chat_group_name", None)
        if group:
            try:
                async_to_sync(self.channel_layer.group_discard)(group, self.channel_name)
            except Exception:
                logger.exception("group_discard failed group=%s channel=%s", group, self.channel_name)

        logger.info("ChatConsumer disconnect user=%s code=%s", getattr(self.user, "id", None), code)

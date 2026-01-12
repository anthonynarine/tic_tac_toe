# Filename: utils/redis/redis_client.py

from redis import Redis
from urllib.parse import urlparse
import os


def get_redis_client() -> Redis:
    """
    Returns a configured Redis client for both local and production environments.

    Why:
    - Local: redis:// (no SSL)
    - Prod (Heroku/Render): rediss:// (SSL)

    Critical:
    - decode_responses=True ensures Redis returns strings (not bytes),
      preventing subtle bugs when comparing user IDs / roles.
    """
    # Step 1: Read REDIS_URL (default to local dev)
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    parsed = urlparse(redis_url)

    # Step 2: Shared connection args
    kwargs: dict = {
        "host": parsed.hostname,
        "port": parsed.port or 6379,
        "db": 0,
        "decode_responses": True,
        "encoding": "utf-8",
    }

    # Step 3: Optional password
    if parsed.password:
        kwargs["password"] = parsed.password

    # Step 4: SSL support for rediss://
    if parsed.scheme == "rediss":
        kwargs.update({
            "ssl": True,
            # Common workaround on free tiers (cert chain issues)
            "ssl_cert_reqs": None,
        })

    # Step 5: Return a reusable client
    return Redis(**kwargs)

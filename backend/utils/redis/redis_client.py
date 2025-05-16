# utils/redis/client.py

from redis import Redis
from urllib.parse import urlparse
import os

def get_redis_client():
    """
    Returns a configured Redis client for both local and production environments.

    Why:
    - Local (e.g., Docker): uses plain TCP via redis://, no SSL needed.
    - Prod (e.g., Heroku, Render): uses rediss://, requires SSL but often lacks full certs.
        We set ssl_cert_reqs=None to prevent connection errors on free tiers.

    Without this dynamic logic, local Redis may crash with:
        TypeError: AbstractConnection.__init__() got an unexpected keyword argument 'ssl_cert_reqs'

    Env:
    - REDIS_URL: set in .env or Heroku config.
        Examples:
            redis://localhost:6379
            rediss://:password@host.compute-1.amazonaws.com:6379

    Returns:
        Redis: A configured Redis client instance for direct use:
            - client.hset(...)
            - client.get(...)
            - client.publish(...)
    """
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    parsed = urlparse(redis_url)

    kwargs = {
        "host": parsed.hostname,
        "port": parsed.port or 6379,
        "db": 0,
    }

    if parsed.password:
        kwargs["password"] = parsed.password

    if parsed.scheme == "rediss":
        kwargs.update({
            "ssl": True,
            "ssl_cert_reqs": None
        })

    return Redis(**kwargs)

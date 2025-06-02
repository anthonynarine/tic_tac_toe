import logging
from threading import Lock
from .langchain_agent import build_agent

logger = logging.getLogger(__name__)

_agent = None
_lock = Lock()

def get_agent():
    global _agent
    if _agent is None:
        with _lock:
            if _agent is None:
                logger.info("Building LangChain agent for the first time...")
                _agent = build_agent()
                logger.info("LangChain agent built successfully.")
    return _agent

def reset_agent():
    global _agent
    with _lock:
        logger.info("Resetting LangChain agent...")
        _agent = build_agent()
        logger.info("LangChain agent reset successfully.")

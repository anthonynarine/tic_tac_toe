import logging

def get_logger(app_name: str) -> logging.Logger:
    """
    Returns a logger instance for a given app/module name.
    This ensures consistent logger naming and enables grouped logging in config.

    Args:
        app_name (str): The base logger name (e.g., "game", "chat")

    Returns:
        logging.Logger: A configured logger instance
    """
    return logging.getLogger(app_name)


def log_event(logger: logging.Logger, app_tag: str, module: str, event: str, message: str, **kwargs):
    """
    Logs an informational message with standardized prefix formatting.

    Format:
        [APP][MODULE][EVENT] Message key=value key=value ...

    Args:
        logger (logging.Logger): The logger to use
        app_tag (str): App identifier (e.g., "game", "chat")
        module (str): The module or file context (e.g., "views", "consumer")
        event (str): The event or action name (e.g., "start_game", "connect")
        message (str): The main log message
        **kwargs: Optional key-value pairs for context
    """
    prefix = f"[{app_tag.upper()}][{module.upper()}][{event.upper()}]"
    extras = " ".join(f"{k}={v}" for k, v in kwargs.items()) if kwargs else ""
    logger.info(f"{prefix} {message} {extras}".strip())


def log_warning(logger: logging.Logger, app_tag: str, module: str, event: str, message: str, **kwargs):
    """
    Logs a warning message with standardized prefix formatting.

    Args:
        logger (logging.Logger): Logger to use
        app_tag (str): App identifier
        module (str): Module or class context
        event (str): Event or action name
        message (str): Warning message
        **kwargs: Optional key-value pairs
    """
    prefix = f"[{app_tag.upper()}][{module.upper()}][{event.upper()}]"
    extras = " ".join(f"{k}={v}" for k, v in kwargs.items()) if kwargs else ""
    logger.warning(f"{prefix} WARNING: {message} {extras}".strip())


def log_error(logger: logging.Logger, app_tag: str, module: str, event: str, message: str, **kwargs):
    """
    Logs an error message with standardized prefix formatting.

    Args:
        logger (logging.Logger): Logger to use
        app_tag (str): App identifier
        module (str): Module or class context
        event (str): Event or action name
        message (str): Error message
        **kwargs: Optional key-value context
    """
    prefix = f"[{app_tag.upper()}][{module.upper()}][{event.upper()}]"
    extras = " ".join(f"{k}={v}" for k, v in kwargs.items()) if kwargs else ""
    logger.error(f"{prefix} ERROR: {message} {extras}".strip())

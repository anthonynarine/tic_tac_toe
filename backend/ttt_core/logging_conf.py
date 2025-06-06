import logging.config
import colorlog

def julia_fiesta_logs():   
    logging_config = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'verbose': {
                '()': 'colorlog.ColoredFormatter',
                'format': '{log_color}{levelname}{reset} {yellow}{asctime}{reset} {blue}{filename}:{lineno}{reset} {green}{module}{reset} {purple}{message}',
                'style': '{',
                'log_colors': {
                    'DEBUG': 'cyan',
                    'INFO': 'green',
                    'WARNING': 'yellow',
                    'ERROR': 'red',
                    'CRITICAL': 'bold_red',
                },
                'secondary_log_colors': {
                    'message': {
                        'DEBUG': 'bold_cyan',
                        'INFO': 'bold_green',
                        'WARNING': 'bold_yellow',
                        'ERROR': 'bold_red',
                        'CRITICAL': 'bold_red',
                    },
                },
                'reset': True,
            },
        },
        'handlers': {
            'console': {
                'level': 'DEBUG',
                'class': 'colorlog.StreamHandler',
                'formatter': 'verbose',
            },
            'file': {
                'level': 'DEBUG',
                'class': 'logging.FileHandler',
                'filename': 'debug.log',
                'formatter': 'verbose',
            },
        },
        'loggers': {
            # Root logger (for anything not caught below)
            '': {
                'handlers': ['console', 'file'],
                'level': 'DEBUG',
                'propagate': True,
            },

            # Django core/system logs
            'django': {
                'handlers': ['console', 'file'],
                'level': 'DEBUG',
                'propagate': True,
            },
            'django.request': {
                'handlers': ['console', 'file'],
                'level': 'DEBUG',
                'propagate': True,
            },

            # App-specific loggers
            'chat': {
                'handlers': ['console', 'file'],
                'level': 'DEBUG',
                'propagate': True,
            },
            'game': {
                'handlers': ['console', 'file'],
                'level': 'DEBUG',
                'propagate': True,
            },
            'friends': {
                'handlers': ['console', 'file'],
                'level': 'DEBUG',
                'propagate': True,
            },
            'users': {
                'handlers': ['console', 'file'],
                'level': 'DEBUG',
                'propagate': True,
            },
        }

    }
    logging.config.dictConfig(logging_config)

"""Configure logging for Docker: stream to stdout (captured by `docker logs`)."""

import logging
import os
import sys
from typing import Optional


def _parse_level(name: Optional[str]) -> int:
    if not name:
        return logging.INFO
    mapping = {
        "CRITICAL": logging.CRITICAL,
        "ERROR": logging.ERROR,
        "WARNING": logging.WARNING,
        "WARN": logging.WARNING,
        "INFO": logging.INFO,
        "DEBUG": logging.DEBUG,
        "NOTSET": logging.NOTSET,
    }
    return mapping.get(name.strip().upper(), logging.INFO)


def configure_logging() -> None:
    level = _parse_level(os.getenv("LOG_LEVEL"))
    fmt = os.getenv(
        "LOG_FORMAT",
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    )

    logging.basicConfig(
        level=level,
        format=fmt,
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout,
        force=True,
    )

    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    if level <= logging.DEBUG:
        logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)
    else:
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

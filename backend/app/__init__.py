"""Backend application package.

This deliberately does NOT import ``backend.app.main`` at package-import time.
``ai/real_model.py`` imports ``backend.app.config`` for its thresholds, and
building the FastAPI app eagerly here would (a) make the ``ai`` layer depend on
the web framework, and (b) risk a circular import, since ``main`` imports the
routers which import this package.

``app`` is still reachable as ``backend.app.app`` via PEP 562 lazy attribute
access; the canonical entry point remains ``backend.app.main:app``.
"""

from typing import Any

__all__ = ["app"]


def __getattr__(name: str) -> Any:
    if name == "app":
        from backend.app.main import app as _app

        return _app
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

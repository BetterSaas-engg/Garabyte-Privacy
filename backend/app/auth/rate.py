"""
Rate limiter for the API.

Defined in its own module so both main.py (which registers the middleware
+ exception handler) and the route modules (which decorate endpoints
with @limiter.limit) can import the same instance without circular imports.
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

# Global default: enough headroom for normal browsing, tight enough that
# enumeration attacks (after the C2 IDOR fix is in place) get capped.
# Per-route decorators in routes/*.py override this with stricter limits
# on auth surfaces.
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

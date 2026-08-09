from jose import JWTError, jwt
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.config import settings


def rate_limit_key(request: Request) -> str:
    """Key the rate limit by the authenticated user, not their IP.

    Keying by IP means every doctor on the same clinic WiFi shares one bucket (one
    busy doctor can lock out their colleagues), and it's trivially bypassed by
    switching networks. All the endpoints this limiter guards require a bearer
    token anyway, so decode it directly here rather than relying on FastAPI's
    dependency injection, which hasn't run yet at this point in the request.
    Falls back to IP if there's no valid token, so an unauthenticated request still
    gets *some* limit rather than none.
    """
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:]
        try:
            payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
            user_id = payload.get("sub")
            if user_id:
                return f"user:{user_id}"
        except JWTError:
            pass
    return get_remote_address(request)


limiter = Limiter(key_func=rate_limit_key)

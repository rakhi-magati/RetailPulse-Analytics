from fastapi import Request


def get_client_ip(request: Request) -> str:
    """
    Resolve the real client IP, respecting a reverse proxy's
    X-Forwarded-For header when present.
    """
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    if request.client:
        return request.client.host

    return "unknown"


def get_client_browser(request: Request) -> str:
    return request.headers.get("user-agent", "unknown")

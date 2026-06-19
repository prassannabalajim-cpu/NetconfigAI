import time
import uuid
import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request

logger = structlog.get_logger(__name__)

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        return response

class AuditLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # We will extract user context from the state if available after auth middleware
        response = await call_next(request)
        # Log essential request info
        logger.info("request_completed", 
                    method=request.method, 
                    url=str(request.url),
                    status_code=response.status_code)
        return response

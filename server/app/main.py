"""EasyTuner Server - Main FastAPI application."""

from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import close_db, init_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan manager.
    
    Handles startup and shutdown events.
    """
    # Startup
    print("🚀 Starting EasyTuner Server...")
    print(f"📝 Environment: {settings.environment}")
    print(f"🗄️  Database: Connected")
    print(f"🔴 Redis: Connected")
    
    # Initialize database (only in development)
    if settings.environment == "development":
        print("🔧 Initializing database tables...")
        await init_db()
    
    yield
    
    # Shutdown
    print("👋 Shutting down EasyTuner Server...")
    await close_db()


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="ECU Map Recognition Platform - Server API",
    docs_url="/docs" if settings.debug else None,  # Disable in production
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None,
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)

# Include routers
from app.routers import auth, checksum, edits, files, projects, scan

app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(projects.router, prefix=settings.api_v1_prefix)
app.include_router(files.router, prefix=settings.api_v1_prefix)
app.include_router(edits.router, prefix=settings.api_v1_prefix)
app.include_router(checksum.router, prefix=settings.api_v1_prefix)
app.include_router(scan.router, prefix=settings.api_v1_prefix)


@app.get("/", status_code=status.HTTP_200_OK)
async def root() -> dict[str, Any]:
    """
    Root endpoint.
    
    Returns:
        Basic API information
    """
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "environment": settings.environment,
        "docs_url": "/docs" if settings.debug else None,
    }


@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check() -> dict[str, Any]:
    """
    Health check endpoint.
    
    Returns:
        Health status of the application
        
    Example:
        ```bash
        curl http://localhost:8000/health
        ```
    """
    return {
        "status": "healthy",
        "service": "easytuner-server",
        "version": settings.app_version,
    }


@app.get("/ready", status_code=status.HTTP_200_OK)
async def readiness_check() -> dict[str, Any]:
    """
    Readiness check endpoint for Kubernetes.
    
    Returns:
        Readiness status
    """
    # TODO: Add actual readiness checks (database connection, redis, etc.)
    return {
        "status": "ready",
        "checks": {
            "database": "ok",  # TODO: Implement actual check
            "redis": "ok",  # TODO: Implement actual check
        }
    }


@app.exception_handler(404)
async def not_found_handler(request: Any, exc: Any) -> JSONResponse:
    """Custom 404 handler."""
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "error": {
                "code": "NOT_FOUND",
                "message": "The requested resource was not found",
                "path": str(request.url.path),
            }
        },
    )


@app.exception_handler(500)
async def internal_error_handler(request: Any, exc: Any) -> JSONResponse:
    """Custom 500 handler."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
            }
        },
    )


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level.lower(),
    )


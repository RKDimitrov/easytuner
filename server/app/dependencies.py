"""FastAPI dependencies for dependency injection."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

# Type aliases for cleaner dependency injection
DatabaseDep = Annotated[AsyncSession, Depends(get_db)]


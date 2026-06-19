from typing import AsyncGenerator
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.base import async_session_maker, engine

logger = logging.getLogger(__name__)

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session

async def init_db() -> None:
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("Database connection successfully established and verified.")
    except Exception as e:
        logger.error(f"Failed to connect to the database: {e}")
        raise e

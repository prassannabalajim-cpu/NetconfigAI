import logging
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import engine, Base

logger = logging.getLogger(__name__)

async def init_db():
    logger.info("Initializing database...")
    async with engine.begin() as conn:
        # We rely on Alembic for migrations, but we can do setup here if needed
        pass

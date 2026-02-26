"""
Scan queue service.

Serialises scan execution so that only one scan runs at a time, preventing
the server from being overwhelmed by concurrent CPU-heavy detection jobs.
Users are informed of their queue position and estimated wait time.
"""
import asyncio
import logging
from collections import deque
from datetime import datetime
from typing import Optional
from uuid import UUID

logger = logging.getLogger(__name__)

# Assumed scan duration used for ETA when no history is available yet (seconds)
_DEFAULT_SCAN_DURATION_S = 8 * 60  # 8 minutes


class ScanQueue:
    """
    Single-worker async queue for scan jobs.

    Only one scan runs at a time. All other submitted jobs wait in order.
    The queue tracks recent scan durations to provide accurate ETAs.
    """

    def __init__(self) -> None:
        self._queue: asyncio.Queue[UUID] = asyncio.Queue()
        # Ordered list of scan_ids waiting to be picked up (mirrors _queue)
        self._waiting: deque[UUID] = deque()
        # scan_id currently being processed (None when idle)
        self._active_scan_id: Optional[UUID] = None
        # Rolling window of recent scan durations (seconds) for ETA estimation
        self._recent_durations: deque[float] = deque(maxlen=10)
        self._worker_task: Optional[asyncio.Task] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Start the background worker. Call once at application startup."""
        if self._worker_task is None or self._worker_task.done():
            self._worker_task = asyncio.create_task(self._worker())
            logger.info("Scan queue worker started")

    async def stop(self) -> None:
        """Gracefully stop the worker. Call at application shutdown."""
        if self._worker_task and not self._worker_task.done():
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        logger.info("Scan queue worker stopped")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def enqueue(self, scan_id: UUID) -> int:
        """
        Add a scan job to the queue.

        Returns the 1-based queue position (1 = next to run).
        """
        self._waiting.append(scan_id)
        await self._queue.put(scan_id)
        position = self._position_of(scan_id)
        logger.info(f"Scan {scan_id} enqueued at position {position}")
        return position

    def position_of(self, scan_id: UUID) -> Optional[int]:
        """
        Return the 1-based queue position of a waiting scan, or None if it
        is not in the queue (already processing or finished).
        """
        if self._active_scan_id == scan_id:
            return 0  # 0 = currently processing
        return self._position_of(scan_id)

    def estimated_wait_seconds(self, scan_id: UUID) -> int:
        """
        Estimated seconds until this scan starts executing.

        For the active scan this is 0. For queued scans it is:
          position * avg_duration
        """
        pos = self.position_of(scan_id)
        if pos is None:
            return 0
        if pos == 0:
            return 0
        avg = self._avg_duration()
        return int(pos * avg)

    @property
    def queued_count(self) -> int:
        return len(self._waiting)

    @property
    def processing_count(self) -> int:
        return 1 if self._active_scan_id is not None else 0

    @property
    def avg_scan_duration_seconds(self) -> int:
        return int(self._avg_duration())

    def global_estimated_wait_seconds(self) -> int:
        """ETA for a brand-new job added right now (after all current jobs)."""
        total = self.queued_count + self.processing_count
        return int(total * self._avg_duration())

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _position_of(self, scan_id: UUID) -> Optional[int]:
        try:
            idx = list(self._waiting).index(scan_id)
            return idx + 1  # 1-based
        except ValueError:
            return None

    def _avg_duration(self) -> float:
        if self._recent_durations:
            return sum(self._recent_durations) / len(self._recent_durations)
        return float(_DEFAULT_SCAN_DURATION_S)

    async def _worker(self) -> None:
        """Background task: pull jobs from the queue and execute them one by one."""
        # Import here to avoid circular imports at module load time
        from app.database import AsyncSessionLocal
        from app.services.scan_service import scan_service

        logger.info("Scan queue worker is running")
        while True:
            scan_id: UUID = await self._queue.get()
            # Remove from waiting list
            try:
                self._waiting.remove(scan_id)
            except ValueError:
                pass  # Already removed (e.g. cancelled)

            self._active_scan_id = scan_id
            started = datetime.utcnow()

            logger.info(f"Queue worker starting scan {scan_id}")
            try:
                async with AsyncSessionLocal() as db:
                    await scan_service.execute_scan(db, scan_id)
            except Exception as exc:
                logger.error(f"Queue worker: scan {scan_id} failed: {exc}", exc_info=True)
            finally:
                elapsed = (datetime.utcnow() - started).total_seconds()
                self._recent_durations.append(elapsed)
                self._active_scan_id = None
                self._queue.task_done()
                logger.info(f"Queue worker finished scan {scan_id} in {elapsed:.1f}s")


# Singleton instance used across the application
scan_queue = ScanQueue()

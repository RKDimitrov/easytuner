"""Celery task definitions."""

from celery import Celery

from app.config import settings

# Create Celery app instance
celery = Celery(
    "easytuner",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

# Configure Celery
celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes
    task_soft_time_limit=270,  # 4.5 minutes
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    worker_max_tasks_per_child=100,
)

# Import tasks here when they're created
# from app.tasks.scan_tasks import scan_firmware
# from app.tasks.export_tasks import export_project

__all__ = ["celery"]

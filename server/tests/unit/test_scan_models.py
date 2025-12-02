"""Tests for ScanJob and Candidate models."""

from datetime import datetime, timedelta, timezone

import pytest
import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import Candidate
from app.models.firmware_file import FirmwareFile
from app.models.project import Project
from app.models.scan_job import ScanJob
from app.models.user import User


@pytest.fixture
async def test_scan_job(
    db_session: AsyncSession, test_firmware_file: FirmwareFile
) -> ScanJob:
    """Create a test scan job."""
    scan = ScanJob(
        file_id=test_firmware_file.file_id,
        status="queued",
        scan_config={"data_types": ["u16LE", "u32LE"], "min_confidence": 0.6},
    )
    db_session.add(scan)
    await db_session.commit()
    await db_session.refresh(scan)
    return scan


@pytest.fixture
async def test_candidate(db_session: AsyncSession, test_scan_job: ScanJob) -> Candidate:
    """Create a test candidate."""
    candidate = Candidate(
        scan_id=test_scan_job.scan_id,
        type="2D",
        confidence=0.85,
        byte_offset_start=1000,
        byte_offset_end=1512,
        data_type="u16LE",
        dimensions={"rows": 16, "cols": 16},
        feature_scores={
            "gradient_smoothness": 0.85,
            "entropy": 0.72,
            "boundary_alignment": 1.0,
        },
        detection_method_version="v1.0.0",
    )
    db_session.add(candidate)
    await db_session.commit()
    await db_session.refresh(candidate)
    return candidate


class TestScanJobModel:
    """Tests for ScanJob model."""

    async def test_create_scan_job(
        self, db_session: AsyncSession, test_firmware_file: FirmwareFile
    ):
        """Test creating a scan job."""
        scan = ScanJob(
            file_id=test_firmware_file.file_id,
            status="queued",
            scan_config={"data_types": ["u16LE"]},
        )
        db_session.add(scan)
        await db_session.commit()
        await db_session.refresh(scan)

        assert scan.scan_id is not None
        assert scan.file_id == test_firmware_file.file_id
        assert scan.status == "queued"
        assert scan.scan_config == {"data_types": ["u16LE"]}
        assert scan.started_at is None
        assert scan.completed_at is None
        assert scan.created_at is not None

    async def test_scan_job_jsonb_config(
        self, db_session: AsyncSession, test_firmware_file: FirmwareFile
    ):
        """Test JSONB scan_config field."""
        config = {
            "data_types": ["u16LE", "u32LE", "float32"],
            "endianness_hint": "little",
            "min_confidence": 0.7,
            "max_candidates": 100,
        }
        scan = ScanJob(
            file_id=test_firmware_file.file_id,
            status="queued",
            scan_config=config,
        )
        db_session.add(scan)
        await db_session.commit()
        await db_session.refresh(scan)

        assert scan.scan_config == config
        assert scan.scan_config["data_types"] == ["u16LE", "u32LE", "float32"]
        assert scan.scan_config["min_confidence"] == 0.7

    async def test_scan_job_status_constraint(
        self, db_session: AsyncSession, test_firmware_file: FirmwareFile
    ):
        """Test that status must be a valid value."""
        scan = ScanJob(
            file_id=test_firmware_file.file_id,
            status="invalid_status",  # Invalid status
            scan_config={},
        )
        db_session.add(scan)

        with pytest.raises(IntegrityError) as exc_info:
            await db_session.commit()
        assert "ck_scan_jobs_status" in str(exc_info.value)

    async def test_start_processing(self, db_session: AsyncSession, test_scan_job: ScanJob):
        """Test starting scan processing."""
        worker_id = "worker-123"
        test_scan_job.start_processing(worker_id)
        await db_session.commit()

        assert test_scan_job.status == "processing"
        assert test_scan_job.started_at is not None
        assert test_scan_job.worker_id == worker_id

    async def test_complete_scan(self, db_session: AsyncSession, test_scan_job: ScanJob):
        """Test completing a scan."""
        test_scan_job.start_processing("worker-1")
        await db_session.commit()

        processing_time = 5000
        test_scan_job.complete(processing_time)
        await db_session.commit()

        assert test_scan_job.status == "completed"
        assert test_scan_job.completed_at is not None
        assert test_scan_job.processing_time_ms == processing_time
        assert test_scan_job.is_finished is True

    async def test_fail_scan(self, db_session: AsyncSession, test_scan_job: ScanJob):
        """Test failing a scan."""
        error_msg = "Out of memory during processing"
        test_scan_job.fail(error_msg)
        await db_session.commit()

        assert test_scan_job.status == "failed"
        assert test_scan_job.completed_at is not None
        assert test_scan_job.error_message == error_msg
        assert test_scan_job.is_finished is True

    async def test_scan_duration_calculation(
        self, db_session: AsyncSession, test_scan_job: ScanJob
    ):
        """Test scan duration calculation."""
        # Initially no duration
        assert test_scan_job.duration_ms is None

        # Start processing
        test_scan_job.start_processing("worker-1")
        test_scan_job.started_at = datetime.now(timezone.utc) - timedelta(seconds=5)
        test_scan_job.completed_at = datetime.now(timezone.utc)
        await db_session.commit()

        # Should have duration around 5000ms
        duration = test_scan_job.duration_ms
        assert duration is not None
        assert 4500 <= duration <= 5500  # Allow some tolerance

    async def test_scan_cascade_delete(
        self, db_session: AsyncSession, test_firmware_file: FirmwareFile
    ):
        """Test that scans are deleted when file is deleted."""
        # Create a scan
        scan = ScanJob(
            file_id=test_firmware_file.file_id,
            status="completed",
            scan_config={},
        )
        db_session.add(scan)
        await db_session.commit()
        scan_id = scan.scan_id

        # Delete the file
        await db_session.delete(test_firmware_file)
        await db_session.commit()

        # Scan should be deleted
        result = await db_session.get(ScanJob, scan_id)
        assert result is None


class TestCandidateModel:
    """Tests for Candidate model."""

    async def test_create_candidate(self, db_session: AsyncSession, test_scan_job: ScanJob):
        """Test creating a candidate."""
        candidate = Candidate(
            scan_id=test_scan_job.scan_id,
            type="1D",
            confidence=0.92,
            byte_offset_start=500,
            byte_offset_end=600,
            data_type="u16LE",
            dimensions={"length": 50},
            feature_scores={"monotonic_score": 0.95},
            detection_method_version="v1.0.0",
        )
        db_session.add(candidate)
        await db_session.commit()
        await db_session.refresh(candidate)

        assert candidate.candidate_id is not None
        assert candidate.scan_id == test_scan_job.scan_id
        assert candidate.type == "1D"
        assert candidate.confidence == 0.92
        assert candidate.byte_offset_start == 500
        assert candidate.byte_offset_end == 600

    async def test_candidate_jsonb_dimensions(
        self, db_session: AsyncSession, test_scan_job: ScanJob
    ):
        """Test JSONB dimensions field."""
        dimensions_2d = {"rows": 16, "cols": 16, "total_elements": 256}
        candidate = Candidate(
            scan_id=test_scan_job.scan_id,
            type="2D",
            confidence=0.88,
            byte_offset_start=1000,
            byte_offset_end=1512,
            data_type="u16LE",
            dimensions=dimensions_2d,
            feature_scores={},
            detection_method_version="v1.0.0",
        )
        db_session.add(candidate)
        await db_session.commit()
        await db_session.refresh(candidate)

        assert candidate.dimensions == dimensions_2d
        assert candidate.dimensions["rows"] == 16
        assert candidate.dimensions["cols"] == 16

    async def test_candidate_jsonb_feature_scores(
        self, db_session: AsyncSession, test_scan_job: ScanJob
    ):
        """Test JSONB feature_scores field."""
        features = {
            "gradient_smoothness": 0.85,
            "entropy": 0.72,
            "boundary_alignment": 1.0,
            "data_coherence": 0.91,
        }
        candidate = Candidate(
            scan_id=test_scan_job.scan_id,
            type="2D",
            confidence=0.88,
            byte_offset_start=1000,
            byte_offset_end=1512,
            data_type="u16LE",
            dimensions={"rows": 16, "cols": 16},
            feature_scores=features,
            detection_method_version="v1.0.0",
        )
        db_session.add(candidate)
        await db_session.commit()
        await db_session.refresh(candidate)

        assert candidate.feature_scores == features
        assert candidate.feature_scores["gradient_smoothness"] == 0.85

    async def test_confidence_constraint_too_high(
        self, db_session: AsyncSession, test_scan_job: ScanJob
    ):
        """Test that confidence > 1.0 is rejected."""
        candidate = Candidate(
            scan_id=test_scan_job.scan_id,
            type="1D",
            confidence=1.5,  # Invalid: > 1.0
            byte_offset_start=0,
            byte_offset_end=100,
            data_type="u16LE",
            dimensions={},
            feature_scores={},
            detection_method_version="v1.0.0",
        )
        db_session.add(candidate)

        with pytest.raises(IntegrityError) as exc_info:
            await db_session.commit()
        assert "ck_candidates_confidence_range" in str(exc_info.value)

    async def test_confidence_constraint_too_low(
        self, db_session: AsyncSession, test_scan_job: ScanJob
    ):
        """Test that confidence < 0.0 is rejected."""
        candidate = Candidate(
            scan_id=test_scan_job.scan_id,
            type="1D",
            confidence=-0.1,  # Invalid: < 0.0
            byte_offset_start=0,
            byte_offset_end=100,
            data_type="u16LE",
            dimensions={},
            feature_scores={},
            detection_method_version="v1.0.0",
        )
        db_session.add(candidate)

        with pytest.raises(IntegrityError) as exc_info:
            await db_session.commit()
        assert "ck_candidates_confidence_range" in str(exc_info.value)

    async def test_byte_offset_order_constraint(
        self, db_session: AsyncSession, test_scan_job: ScanJob
    ):
        """Test that byte_offset_end must be > byte_offset_start."""
        candidate = Candidate(
            scan_id=test_scan_job.scan_id,
            type="1D",
            confidence=0.8,
            byte_offset_start=500,
            byte_offset_end=400,  # Invalid: end < start
            data_type="u16LE",
            dimensions={},
            feature_scores={},
            detection_method_version="v1.0.0",
        )
        db_session.add(candidate)

        with pytest.raises(IntegrityError) as exc_info:
            await db_session.commit()
        assert "ck_candidates_byte_offset_order" in str(exc_info.value)

    async def test_type_constraint(
        self, db_session: AsyncSession, test_scan_job: ScanJob
    ):
        """Test that type must be a valid value."""
        candidate = Candidate(
            scan_id=test_scan_job.scan_id,
            type="4D",  # Invalid type
            confidence=0.8,
            byte_offset_start=0,
            byte_offset_end=100,
            data_type="u16LE",
            dimensions={},
            feature_scores={},
            detection_method_version="v1.0.0",
        )
        db_session.add(candidate)

        with pytest.raises(IntegrityError) as exc_info:
            await db_session.commit()
        assert "ck_candidates_type" in str(exc_info.value)

    async def test_candidate_properties(
        self, db_session: AsyncSession, test_candidate: Candidate
    ):
        """Test candidate helper properties."""
        # size_bytes
        expected_size = test_candidate.byte_offset_end - test_candidate.byte_offset_start
        assert test_candidate.size_bytes == expected_size
        assert test_candidate.size_bytes == 512

        # is_high_confidence
        assert test_candidate.is_high_confidence is True  # 0.85 >= 0.8

        # is_multidimensional
        assert test_candidate.is_multidimensional is True  # type='2D'

    async def test_candidate_cascade_delete(
        self, db_session: AsyncSession, test_scan_job: ScanJob
    ):
        """Test that candidates are deleted when scan is deleted."""
        # Create a candidate
        candidate = Candidate(
            scan_id=test_scan_job.scan_id,
            type="1D",
            confidence=0.9,
            byte_offset_start=0,
            byte_offset_end=100,
            data_type="u16LE",
            dimensions={},
            feature_scores={},
            detection_method_version="v1.0.0",
        )
        db_session.add(candidate)
        await db_session.commit()
        candidate_id = candidate.candidate_id

        # Delete the scan
        await db_session.delete(test_scan_job)
        await db_session.commit()

        # Candidate should be deleted
        result = await db_session.get(Candidate, candidate_id)
        assert result is None


class TestScanRelationships:
    """Tests for scan model relationships."""

    async def test_file_to_scans_relationship(
        self, db_session: AsyncSession, test_firmware_file: FirmwareFile
    ):
        """Test firmware file to scans relationship."""
        from sqlalchemy.orm import selectinload

        # Create multiple scans
        scan1 = ScanJob(
            file_id=test_firmware_file.file_id,
            status="completed",
            scan_config={"data_types": ["u16LE"]},
        )
        scan2 = ScanJob(
            file_id=test_firmware_file.file_id,
            status="failed",
            scan_config={"data_types": ["u32LE"]},
        )
        db_session.add_all([scan1, scan2])
        await db_session.commit()

        # Reload file with scans
        query = (
            select(FirmwareFile)
            .where(FirmwareFile.file_id == test_firmware_file.file_id)
            .options(selectinload(FirmwareFile.scans))
        )
        result = await db_session.execute(query)
        file_with_scans = result.scalar_one()

        assert len(file_with_scans.scans) == 2
        statuses = {s.status for s in file_with_scans.scans}
        assert statuses == {"completed", "failed"}

    async def test_scan_to_candidates_relationship(
        self, db_session: AsyncSession, test_scan_job: ScanJob
    ):
        """Test scan to candidates relationship."""
        from sqlalchemy.orm import selectinload

        # Create multiple candidates
        candidate1 = Candidate(
            scan_id=test_scan_job.scan_id,
            type="1D",
            confidence=0.9,
            byte_offset_start=0,
            byte_offset_end=100,
            data_type="u16LE",
            dimensions={},
            feature_scores={},
            detection_method_version="v1.0.0",
        )
        candidate2 = Candidate(
            scan_id=test_scan_job.scan_id,
            type="2D",
            confidence=0.85,
            byte_offset_start=1000,
            byte_offset_end=1512,
            data_type="u16LE",
            dimensions={"rows": 16, "cols": 16},
            feature_scores={},
            detection_method_version="v1.0.0",
        )
        db_session.add_all([candidate1, candidate2])
        await db_session.commit()

        # Reload scan with candidates
        query = (
            select(ScanJob)
            .where(ScanJob.scan_id == test_scan_job.scan_id)
            .options(selectinload(ScanJob.candidates))
        )
        result = await db_session.execute(query)
        scan_with_candidates = result.scalar_one()

        assert len(scan_with_candidates.candidates) == 2
        types = {c.type for c in scan_with_candidates.candidates}
        assert types == {"1D", "2D"}


class TestJSONBQueries:
    """Tests for querying JSONB fields."""

    async def test_query_by_scan_config(
        self, db_session: AsyncSession, test_firmware_file: FirmwareFile
    ):
        """Test querying scans by config values."""
        # Create scans with different configs
        scan1 = ScanJob(
            file_id=test_firmware_file.file_id,
            status="completed",
            scan_config={"data_types": ["u16LE"], "min_confidence": 0.8},
        )
        scan2 = ScanJob(
            file_id=test_firmware_file.file_id,
            status="completed",
            scan_config={"data_types": ["u32LE"], "min_confidence": 0.6},
        )
        db_session.add_all([scan1, scan2])
        await db_session.commit()

        # Query scans with min_confidence > 0.7
        query = select(ScanJob).where(
            ScanJob.scan_config["min_confidence"]
            .astext.cast(sa.Float)
            > 0.7
        )
        result = await db_session.execute(query)
        scans = result.scalars().all()

        assert len(scans) == 1
        assert scans[0].scan_id == scan1.scan_id

    async def test_query_by_feature_scores(
        self, db_session: AsyncSession, test_scan_job: ScanJob
    ):
        """Test querying candidates by feature scores."""
        # Create candidates with different feature scores
        candidate1 = Candidate(
            scan_id=test_scan_job.scan_id,
            type="2D",
            confidence=0.9,
            byte_offset_start=0,
            byte_offset_end=512,
            data_type="u16LE",
            dimensions={},
            feature_scores={"gradient_smoothness": 0.9},
            detection_method_version="v1.0.0",
        )
        candidate2 = Candidate(
            scan_id=test_scan_job.scan_id,
            type="2D",
            confidence=0.7,
            byte_offset_start=1000,
            byte_offset_end=1512,
            data_type="u16LE",
            dimensions={},
            feature_scores={"gradient_smoothness": 0.6},
            detection_method_version="v1.0.0",
        )
        db_session.add_all([candidate1, candidate2])
        await db_session.commit()

        # Query candidates with gradient_smoothness > 0.8
        query = select(Candidate).where(
            Candidate.feature_scores["gradient_smoothness"]
            .astext.cast(sa.Float)
            > 0.8
        )
        result = await db_session.execute(query)
        candidates = result.scalars().all()

        assert len(candidates) == 1
        assert candidates[0].candidate_id == candidate1.candidate_id

    async def test_query_by_dimensions(
        self, db_session: AsyncSession, test_scan_job: ScanJob
    ):
        """Test querying candidates by dimensions."""
        # Create candidates with different dimensions
        candidate1 = Candidate(
            scan_id=test_scan_job.scan_id,
            type="2D",
            confidence=0.9,
            byte_offset_start=0,
            byte_offset_end=512,
            data_type="u16LE",
            dimensions={"rows": 16, "cols": 16},
            feature_scores={},
            detection_method_version="v1.0.0",
        )
        candidate2 = Candidate(
            scan_id=test_scan_job.scan_id,
            type="2D",
            confidence=0.8,
            byte_offset_start=1000,
            byte_offset_end=2048,
            data_type="u16LE",
            dimensions={"rows": 32, "cols": 32},
            feature_scores={},
            detection_method_version="v1.0.0",
        )
        db_session.add_all([candidate1, candidate2])
        await db_session.commit()

        # Query candidates with rows = 16
        query = select(Candidate).where(
            Candidate.dimensions["rows"].astext.cast(sa.Integer) == 16
        )
        result = await db_session.execute(query)
        candidates = result.scalars().all()

        assert len(candidates) == 1
        assert candidates[0].candidate_id == candidate1.candidate_id


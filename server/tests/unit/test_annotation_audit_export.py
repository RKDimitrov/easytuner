"""Tests for Annotation, AuditLog, and Export models."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.annotation import Annotation
from app.models.audit_log import AuditLog
from app.models.candidate import Candidate
from app.models.export import Export
from app.models.project import Project
from app.models.user import User


class TestAnnotationModel:
    """Tests for Annotation model."""

    async def test_create_annotation(
        self, db_session: AsyncSession, test_candidate: Candidate, test_user: User
    ):
        """Test creating an annotation."""
        annotation = Annotation(
            candidate_id=test_candidate.candidate_id,
            user_id=test_user.user_id,
            label="Fuel Map",
            notes="This appears to be a 16x16 fuel map",
            tags=["fuel", "confirmed", "16x16"],
            validation_status="verified",
        )
        db_session.add(annotation)
        await db_session.commit()
        await db_session.refresh(annotation)

        assert annotation.annotation_id is not None
        assert annotation.candidate_id == test_candidate.candidate_id
        assert annotation.user_id == test_user.user_id
        assert annotation.label == "Fuel Map"
        assert annotation.tags == ["fuel", "confirmed", "16x16"]
        assert annotation.validation_status == "verified"
        assert annotation.created_at is not None

    async def test_annotation_with_empty_tags(
        self, db_session: AsyncSession, test_candidate: Candidate, test_user: User
    ):
        """Test annotation with no tags."""
        annotation = Annotation(
            candidate_id=test_candidate.candidate_id,
            user_id=test_user.user_id,
            label="Unknown Map",
            tags=[],
        )
        db_session.add(annotation)
        await db_session.commit()
        await db_session.refresh(annotation)

        assert annotation.tags == []

    async def test_annotation_validation_status_constraint(
        self, db_session: AsyncSession, test_candidate: Candidate, test_user: User
    ):
        """Test that validation_status must be a valid value or NULL."""
        annotation = Annotation(
            candidate_id=test_candidate.candidate_id,
            user_id=test_user.user_id,
            label="Test",
            tags=[],
            validation_status="invalid_status",  # Invalid
        )
        db_session.add(annotation)

        with pytest.raises(IntegrityError) as exc_info:
            await db_session.commit()
        assert "ck_annotations_validation_status" in str(exc_info.value)

    async def test_annotation_verification_methods(
        self, db_session: AsyncSession, test_candidate: Candidate, test_user: User
    ):
        """Test annotation verification helper methods."""
        annotation = Annotation(
            candidate_id=test_candidate.candidate_id,
            user_id=test_user.user_id,
            label="Test Map",
            tags=[],
        )
        db_session.add(annotation)
        await db_session.commit()

        # Initially needs review
        assert annotation.needs_review is True
        assert annotation.is_verified is False
        assert annotation.is_rejected is False

        # Verify
        annotation.verify()
        await db_session.commit()
        assert annotation.is_verified is True
        assert annotation.needs_review is False

        # Reject
        annotation.reject()
        await db_session.commit()
        assert annotation.is_rejected is True
        assert annotation.is_verified is False

        # Mark uncertain
        annotation.mark_uncertain()
        await db_session.commit()
        assert annotation.validation_status == "uncertain"
        assert annotation.needs_review is True

    async def test_annotation_cascade_delete(
        self, db_session: AsyncSession, test_candidate: Candidate, test_user: User
    ):
        """Test that annotations are deleted when candidate is deleted."""
        annotation = Annotation(
            candidate_id=test_candidate.candidate_id,
            user_id=test_user.user_id,
            label="Test",
            tags=[],
        )
        db_session.add(annotation)
        await db_session.commit()
        annotation_id = annotation.annotation_id

        # Delete candidate
        await db_session.delete(test_candidate)
        await db_session.commit()

        # Annotation should be deleted
        result = await db_session.get(Annotation, annotation_id)
        assert result is None

    async def test_query_by_tags(
        self, db_session: AsyncSession, test_candidate: Candidate, test_user: User
    ):
        """Test querying annotations by tags using array contains."""
        # Create annotations with different tags
        annotation1 = Annotation(
            candidate_id=test_candidate.candidate_id,
            user_id=test_user.user_id,
            label="Fuel Map",
            tags=["fuel", "confirmed"],
        )
        annotation2 = Annotation(
            candidate_id=test_candidate.candidate_id,
            user_id=test_user.user_id,
            label="Ignition Map",
            tags=["ignition", "confirmed"],
        )
        annotation3 = Annotation(
            candidate_id=test_candidate.candidate_id,
            user_id=test_user.user_id,
            label="Unknown",
            tags=["uncertain"],
        )
        db_session.add_all([annotation1, annotation2, annotation3])
        await db_session.commit()

        # Query annotations with "confirmed" tag
        # Use PostgreSQL array contains operator @>
        query = select(Annotation).where(Annotation.tags.op("@>")(["confirmed"]))
        result = await db_session.execute(query)
        annotations = result.scalars().all()

        assert len(annotations) == 2
        labels = {a.label for a in annotations}
        assert labels == {"Fuel Map", "Ignition Map"}

    async def test_query_by_any_tag(
        self, db_session: AsyncSession, test_candidate: Candidate, test_user: User
    ):
        """Test querying annotations by any tag match."""
        annotation = Annotation(
            candidate_id=test_candidate.candidate_id,
            user_id=test_user.user_id,
            label="Test",
            tags=["fuel", "16x16", "confirmed"],
        )
        db_session.add(annotation)
        await db_session.commit()

        # Query by any tag using overlap operator &&
        query = select(Annotation).where(Annotation.tags.op("&&")(["fuel", "ignition"]))
        result = await db_session.execute(query)
        found = result.scalars().all()

        assert len(found) == 1
        assert found[0].annotation_id == annotation.annotation_id


class TestAuditLogModel:
    """Tests for AuditLog model."""

    async def test_create_audit_log(self, db_session: AsyncSession, test_user: User):
        """Test creating an audit log entry."""
        log = AuditLog(
            user_id=test_user.user_id,
            action_type="file.upload",
            resource_type="firmware_file",
            resource_id=uuid4(),
            ip_address="192.168.1.100",
            user_agent="Mozilla/5.0",
            attestation_text="User uploaded firmware file",
            event_metadata={"filename": "ecu_dump.bin", "size": 524288},
        )
        db_session.add(log)
        await db_session.commit()
        await db_session.refresh(log)

        assert log.log_id is not None
        assert log.user_id == test_user.user_id
        assert log.action_type == "file.upload"
        assert log.resource_type == "firmware_file"
        assert str(log.ip_address) == "192.168.1.100"
        assert log.event_metadata == {"filename": "ecu_dump.bin", "size": 524288}
        assert log.timestamp is not None

    async def test_audit_log_without_user(self, db_session: AsyncSession):
        """Test creating a system audit log without user."""
        log = AuditLog(
            user_id=None,  # System action
            action_type="system.startup",
            resource_type="system",
            resource_id=uuid4(),
            attestation_text="System started",
            event_metadata={"version": "0.1.0"},
        )
        db_session.add(log)
        await db_session.commit()
        await db_session.refresh(log)

        assert log.user_id is None
        assert log.action_type == "system.startup"

    async def test_audit_log_factory_method(self, db_session: AsyncSession, test_user: User):
        """Test using the factory method to create logs."""
        resource_id = uuid4()
        log = AuditLog.create_log(
            action_type="project.create",
            resource_type="project",
            resource_id=resource_id,
            user_id=test_user.user_id,
            ip_address="10.0.0.1",
            event_metadata={"project_name": "My Project"},
        )
        db_session.add(log)
        await db_session.commit()
        await db_session.refresh(log)

        assert log.action_type == "project.create"
        assert log.resource_id == resource_id
        assert log.event_metadata["project_name"] == "My Project"

    async def test_audit_log_ipv6_address(self, db_session: AsyncSession, test_user: User):
        """Test audit log with IPv6 address."""
        log = AuditLog(
            user_id=test_user.user_id,
            action_type="user.login",
            resource_type="user",
            resource_id=test_user.user_id,
            ip_address="2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        )
        db_session.add(log)
        await db_session.commit()
        await db_session.refresh(log)

        # IPv6 addresses are compressed by PostgreSQL
        assert log.ip_address is not None
        assert str(log.ip_address) == "2001:db8:85a3::8a2e:370:7334"

    async def test_query_audit_logs_by_action_type(
        self, db_session: AsyncSession, test_user: User
    ):
        """Test querying audit logs by action type."""
        # Create multiple log entries
        logs = [
            AuditLog.create_log(
                "user.login",
                "user",
                test_user.user_id,
                user_id=test_user.user_id,
            ),
            AuditLog.create_log(
                "file.upload",
                "firmware_file",
                uuid4(),
                user_id=test_user.user_id,
            ),
            AuditLog.create_log(
                "user.login",
                "user",
                test_user.user_id,
                user_id=test_user.user_id,
            ),
        ]
        db_session.add_all(logs)
        await db_session.commit()

        # Query login actions
        query = select(AuditLog).where(AuditLog.action_type == "user.login")
        result = await db_session.execute(query)
        login_logs = result.scalars().all()

        assert len(login_logs) == 2

    async def test_query_audit_logs_by_metadata(
        self, db_session: AsyncSession, test_user: User
    ):
        """Test querying audit logs by metadata fields."""
        log1 = AuditLog.create_log(
            "file.upload",
            "firmware_file",
            uuid4(),
            user_id=test_user.user_id,
            event_metadata={"size": 1024000},
        )
        log2 = AuditLog.create_log(
            "file.upload",
            "firmware_file",
            uuid4(),
            user_id=test_user.user_id,
            event_metadata={"size": 500000},
        )
        db_session.add_all([log1, log2])
        await db_session.commit()

        # Query logs with size > 800000
        query = select(AuditLog).where(
            AuditLog.event_metadata["size"].astext.cast(sa.Integer) > 800000
        )
        result = await db_session.execute(query)
        large_files = result.scalars().all()

        assert len(large_files) == 1
        assert large_files[0].log_id == log1.log_id


class TestExportModel:
    """Tests for Export model."""

    async def test_create_export(
        self, db_session: AsyncSession, test_project: Project, test_user: User
    ):
        """Test creating an export."""
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        export = Export(
            project_id=test_project.project_id,
            user_id=test_user.user_id,
            format="json",
            storage_path="/exports/project_123.json",
            size_bytes=15000,
            expires_at=expires_at,
            attestation_sha256="a" * 64,
        )
        db_session.add(export)
        await db_session.commit()
        await db_session.refresh(export)

        assert export.export_id is not None
        assert export.project_id == test_project.project_id
        assert export.user_id == test_user.user_id
        assert export.format == "json"
        assert export.size_bytes == 15000
        assert export.downloaded_at is None
        assert export.created_at is not None

    async def test_export_format_constraint(
        self, db_session: AsyncSession, test_project: Project, test_user: User
    ):
        """Test that format must be json, pdf, or csv."""
        export = Export(
            project_id=test_project.project_id,
            user_id=test_user.user_id,
            format="xml",  # Invalid format
            storage_path="/exports/test.xml",
            size_bytes=1000,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            attestation_sha256="b" * 64,
        )
        db_session.add(export)

        with pytest.raises(IntegrityError) as exc_info:
            await db_session.commit()
        assert "ck_exports_format" in str(exc_info.value)

    async def test_export_valid_formats(
        self, db_session: AsyncSession, test_project: Project, test_user: User
    ):
        """Test all valid export formats."""
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        formats = ["json", "pdf", "csv"]

        for fmt in formats:
            export = Export(
                project_id=test_project.project_id,
                user_id=test_user.user_id,
                format=fmt,
                storage_path=f"/exports/test.{fmt}",
                size_bytes=1000,
                expires_at=expires_at,
                attestation_sha256="c" * 64,
            )
            db_session.add(export)
            await db_session.commit()
            await db_session.refresh(export)

            assert export.format == fmt

    async def test_export_is_expired(
        self, db_session: AsyncSession, test_project: Project, test_user: User
    ):
        """Test checking if export is expired."""
        # Create expired export
        expired_export = Export(
            project_id=test_project.project_id,
            user_id=test_user.user_id,
            format="json",
            storage_path="/exports/expired.json",
            size_bytes=1000,
            expires_at=datetime.now(timezone.utc) - timedelta(days=1),  # Yesterday
            attestation_sha256="d" * 64,
        )
        db_session.add(expired_export)
        await db_session.commit()

        assert expired_export.is_expired is True

        # Create non-expired export
        valid_export = Export(
            project_id=test_project.project_id,
            user_id=test_user.user_id,
            format="json",
            storage_path="/exports/valid.json",
            size_bytes=1000,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            attestation_sha256="e" * 64,
        )
        db_session.add(valid_export)
        await db_session.commit()

        assert valid_export.is_expired is False

    async def test_export_mark_downloaded(
        self, db_session: AsyncSession, test_project: Project, test_user: User
    ):
        """Test marking export as downloaded."""
        export = Export(
            project_id=test_project.project_id,
            user_id=test_user.user_id,
            format="pdf",
            storage_path="/exports/report.pdf",
            size_bytes=50000,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            attestation_sha256="f" * 64,
        )
        db_session.add(export)
        await db_session.commit()

        # Initially not downloaded
        assert export.has_been_downloaded is False
        assert export.downloaded_at is None

        # Mark as downloaded
        export.mark_downloaded()
        await db_session.commit()

        assert export.has_been_downloaded is True
        assert export.downloaded_at is not None

        # Second call shouldn't change the timestamp
        first_download_time = export.downloaded_at
        export.mark_downloaded()
        await db_session.commit()

        assert export.downloaded_at == first_download_time

    async def test_export_cascade_delete(
        self, db_session: AsyncSession, test_project: Project, test_user: User
    ):
        """Test that exports are deleted when project is deleted."""
        export = Export(
            project_id=test_project.project_id,
            user_id=test_user.user_id,
            format="csv",
            storage_path="/exports/data.csv",
            size_bytes=2000,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            attestation_sha256="g" * 64,
        )
        db_session.add(export)
        await db_session.commit()
        export_id = export.export_id

        # Delete project
        await db_session.delete(test_project)
        await db_session.commit()

        # Export should be deleted
        result = await db_session.get(Export, export_id)
        assert result is None

    async def test_query_expired_exports(
        self, db_session: AsyncSession, test_project: Project, test_user: User
    ):
        """Test querying for expired exports."""
        now = datetime.now(timezone.utc)

        # Create expired and valid exports
        expired1 = Export(
            project_id=test_project.project_id,
            user_id=test_user.user_id,
            format="json",
            storage_path="/exports/expired1.json",
            size_bytes=1000,
            expires_at=now - timedelta(days=1),
            attestation_sha256="h" * 64,
        )
        expired2 = Export(
            project_id=test_project.project_id,
            user_id=test_user.user_id,
            format="json",
            storage_path="/exports/expired2.json",
            size_bytes=1000,
            expires_at=now - timedelta(hours=1),
            attestation_sha256="i" * 64,
        )
        valid = Export(
            project_id=test_project.project_id,
            user_id=test_user.user_id,
            format="json",
            storage_path="/exports/valid.json",
            size_bytes=1000,
            expires_at=now + timedelta(days=7),
            attestation_sha256="j" * 64,
        )
        db_session.add_all([expired1, expired2, valid])
        await db_session.commit()

        # Query expired exports
        query = select(Export).where(Export.expires_at < now)
        result = await db_session.execute(query)
        expired_exports = result.scalars().all()

        assert len(expired_exports) == 2


class TestModelRelationships:
    """Tests for relationships between new models."""

    async def test_candidate_to_annotations(
        self, db_session: AsyncSession, test_candidate: Candidate, test_user: User
    ):
        """Test candidate to annotations relationship."""
        from sqlalchemy.orm import selectinload

        # Create multiple annotations
        annotation1 = Annotation(
            candidate_id=test_candidate.candidate_id,
            user_id=test_user.user_id,
            label="First Label",
            tags=[],
        )
        annotation2 = Annotation(
            candidate_id=test_candidate.candidate_id,
            user_id=test_user.user_id,
            label="Second Label",
            tags=[],
        )
        db_session.add_all([annotation1, annotation2])
        await db_session.commit()

        # Reload candidate with annotations
        query = (
            select(Candidate)
            .where(Candidate.candidate_id == test_candidate.candidate_id)
            .options(selectinload(Candidate.annotations))
        )
        result = await db_session.execute(query)
        candidate_with_annotations = result.scalar_one()

        assert len(candidate_with_annotations.annotations) == 2
        labels = {a.label for a in candidate_with_annotations.annotations}
        assert labels == {"First Label", "Second Label"}

    async def test_user_to_annotations(
        self, db_session: AsyncSession, test_candidate: Candidate, test_user: User
    ):
        """Test user to annotations relationship."""
        from sqlalchemy.orm import selectinload

        # Create annotations
        annotation = Annotation(
            candidate_id=test_candidate.candidate_id,
            user_id=test_user.user_id,
            label="User's Annotation",
            tags=[],
        )
        db_session.add(annotation)
        await db_session.commit()

        # Reload user with annotations
        query = (
            select(User)
            .where(User.user_id == test_user.user_id)
            .options(selectinload(User.annotations))
        )
        result = await db_session.execute(query)
        user_with_annotations = result.scalar_one()

        assert len(user_with_annotations.annotations) == 1
        assert user_with_annotations.annotations[0].label == "User's Annotation"

    async def test_project_to_exports(
        self, db_session: AsyncSession, test_project: Project, test_user: User
    ):
        """Test project to exports relationship."""
        from sqlalchemy.orm import selectinload

        # Create exports
        export1 = Export(
            project_id=test_project.project_id,
            user_id=test_user.user_id,
            format="json",
            storage_path="/exports/export1.json",
            size_bytes=1000,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            attestation_sha256="k" * 64,
        )
        export2 = Export(
            project_id=test_project.project_id,
            user_id=test_user.user_id,
            format="pdf",
            storage_path="/exports/export2.pdf",
            size_bytes=2000,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            attestation_sha256="l" * 64,
        )
        db_session.add_all([export1, export2])
        await db_session.commit()

        # Reload project with exports
        query = (
            select(Project)
            .where(Project.project_id == test_project.project_id)
            .options(selectinload(Project.exports))
        )
        result = await db_session.execute(query)
        project_with_exports = result.scalar_one()

        assert len(project_with_exports.exports) == 2
        formats = {e.format for e in project_with_exports.exports}
        assert formats == {"json", "pdf"}


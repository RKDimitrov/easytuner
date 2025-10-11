"""Tests for database models."""

from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.firmware_file import FirmwareFile
from app.models.project import Project
from app.models.session import Session
from app.models.user import User


class TestUserModel:
    """Tests for User model."""

    async def test_create_user(self, db_session: AsyncSession):
        """Test creating a user."""
        user = User(
            email="newuser@example.com",
            password_hash="hashed_password",
            role="user",
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        assert user.user_id is not None
        assert user.email == "newuser@example.com"
        assert user.role == "user"
        assert user.is_active is True
        assert user.created_at is not None
        assert user.updated_at is not None

    async def test_user_unique_email_constraint(self, db_session: AsyncSession):
        """Test that email must be unique."""
        user1 = User(
            email="duplicate@example.com",
            password_hash="hash1",
            role="user",
        )
        db_session.add(user1)
        await db_session.commit()

        user2 = User(
            email="duplicate@example.com",
            password_hash="hash2",
            role="user",
        )
        db_session.add(user2)
        
        with pytest.raises(IntegrityError):
            await db_session.commit()

    async def test_user_relationships(self, db_session: AsyncSession, test_user: User):
        """Test user relationships."""
        from sqlalchemy.orm import selectinload
        
        # Create a project for the user
        project = Project(
            owner_user_id=test_user.user_id,
            name="Test Project",
            is_private=True,
        )
        db_session.add(project)
        await db_session.commit()

        # Reload user with eager loading
        query = select(User).where(User.user_id == test_user.user_id).options(selectinload(User.projects))
        result = await db_session.execute(query)
        user_with_projects = result.scalar_one()
        
        assert len(user_with_projects.projects) == 1
        assert user_with_projects.projects[0].name == "Test Project"


class TestSessionModel:
    """Tests for Session model."""

    async def test_create_session(self, db_session: AsyncSession, test_user: User):
        """Test creating a session."""
        from datetime import timezone
        expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        session = Session(
            user_id=test_user.user_id,
            refresh_token_hash="a" * 64,
            expires_at=expires_at,
            ip_address="127.0.0.1",
            user_agent="Test Browser",
        )
        db_session.add(session)
        await db_session.commit()
        await db_session.refresh(session)

        assert session.session_id is not None
        assert session.user_id == test_user.user_id
        assert session.refresh_token_hash == "a" * 64
        # Compare timestamps allowing for small differences
        assert abs((session.expires_at - expires_at).total_seconds()) < 1
        assert session.created_at is not None

    async def test_session_cascade_delete(self, db_session: AsyncSession, test_user: User):
        """Test that sessions are deleted when user is deleted."""
        # Create a session
        session = Session(
            user_id=test_user.user_id,
            refresh_token_hash="b" * 64,
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
        db_session.add(session)
        await db_session.commit()
        session_id = session.session_id

        # Delete the user
        await db_session.delete(test_user)
        await db_session.commit()

        # Session should be deleted
        result = await db_session.get(Session, session_id)
        assert result is None


class TestProjectModel:
    """Tests for Project model."""

    async def test_create_project(self, db_session: AsyncSession, test_user: User):
        """Test creating a project."""
        project = Project(
            owner_user_id=test_user.user_id,
            name="My ECU Project",
            description="Testing ECU firmware",
            is_private=True,
        )
        db_session.add(project)
        await db_session.commit()
        await db_session.refresh(project)

        assert project.project_id is not None
        assert project.owner_user_id == test_user.user_id
        assert project.name == "My ECU Project"
        assert project.is_private is True
        assert project.deleted_at is None
        assert project.created_at is not None

    async def test_project_soft_delete(self, db_session: AsyncSession, test_project: Project):
        """Test soft delete functionality."""
        # Soft delete the project
        test_project.soft_delete()
        await db_session.commit()

        # Project should still exist in database
        result = await db_session.get(Project, test_project.project_id)
        assert result is not None
        assert result.deleted_at is not None
        assert result.is_deleted is True

    async def test_project_restore(self, db_session: AsyncSession, test_project: Project):
        """Test restoring a soft-deleted project."""
        # Soft delete
        test_project.soft_delete()
        await db_session.commit()
        assert test_project.is_deleted is True

        # Restore
        test_project.restore()
        await db_session.commit()
        assert test_project.is_deleted is False
        assert test_project.deleted_at is None

    async def test_project_cascade_delete(
        self, db_session: AsyncSession, test_project: Project
    ):
        """Test that projects are deleted when user is deleted."""
        project_id = test_project.project_id
        owner_id = test_project.owner_user_id

        # Get the owner
        owner = await db_session.get(User, owner_id)
        
        # Delete the owner
        await db_session.delete(owner)
        await db_session.commit()

        # Project should be deleted
        result = await db_session.get(Project, project_id)
        assert result is None


class TestFirmwareFileModel:
    """Tests for FirmwareFile model."""

    async def test_create_firmware_file(
        self, db_session: AsyncSession, test_project: Project
    ):
        """Test creating a firmware file."""
        firmware_file = FirmwareFile(
            project_id=test_project.project_id,
            filename="ecu_dump.bin",
            size_bytes=524288,
            sha256="c" * 64,
            storage_path="/minio/uploads/ecu_dump.bin",
            endianness_hint="big",
        )
        db_session.add(firmware_file)
        await db_session.commit()
        await db_session.refresh(firmware_file)

        assert firmware_file.file_id is not None
        assert firmware_file.project_id == test_project.project_id
        assert firmware_file.filename == "ecu_dump.bin"
        assert firmware_file.size_bytes == 524288
        assert firmware_file.sha256 == "c" * 64
        assert firmware_file.endianness_hint == "big"
        assert firmware_file.uploaded_at is not None
        assert firmware_file.deleted_at is None

    async def test_firmware_file_soft_delete(
        self, db_session: AsyncSession, test_firmware_file: FirmwareFile
    ):
        """Test soft delete functionality."""
        # Soft delete
        test_firmware_file.soft_delete()
        await db_session.commit()

        # File should still exist in database
        result = await db_session.get(FirmwareFile, test_firmware_file.file_id)
        assert result is not None
        assert result.deleted_at is not None
        assert result.is_deleted is True

    async def test_firmware_file_duplicate_hash_detection(
        self, db_session: AsyncSession, test_project: Project
    ):
        """Test detecting duplicate file hashes."""
        sha256_hash = "d" * 64

        # Create first file
        file1 = FirmwareFile(
            project_id=test_project.project_id,
            filename="file1.bin",
            size_bytes=1024,
            sha256=sha256_hash,
            storage_path="/path/file1.bin",
        )
        db_session.add(file1)
        await db_session.commit()

        # Create second file with same hash (should be allowed, same content)
        file2 = FirmwareFile(
            project_id=test_project.project_id,
            filename="file2.bin",
            size_bytes=1024,
            sha256=sha256_hash,
            storage_path="/path/file2.bin",
        )
        db_session.add(file2)
        await db_session.commit()

        # Query for files with this hash
        query = select(FirmwareFile).where(FirmwareFile.sha256 == sha256_hash)
        result = await db_session.execute(query)
        files = result.scalars().all()
        
        assert len(files) == 2
        assert all(f.sha256 == sha256_hash for f in files)

    async def test_firmware_file_cascade_delete(
        self, db_session: AsyncSession, test_firmware_file: FirmwareFile
    ):
        """Test that files are deleted when project is deleted."""
        file_id = test_firmware_file.file_id
        project_id = test_firmware_file.project_id

        # Get the project
        project = await db_session.get(Project, project_id)
        
        # Delete the project
        await db_session.delete(project)
        await db_session.commit()

        # File should be deleted
        result = await db_session.get(FirmwareFile, file_id)
        assert result is None


class TestModelRelationships:
    """Tests for model relationships."""

    async def test_user_to_projects_relationship(
        self, db_session: AsyncSession, test_user: User
    ):
        """Test user to projects relationship."""
        from sqlalchemy.orm import selectinload
        
        # Create multiple projects
        project1 = Project(
            owner_user_id=test_user.user_id,
            name="Project 1",
            is_private=True,
        )
        project2 = Project(
            owner_user_id=test_user.user_id,
            name="Project 2",
            is_private=False,
        )
        db_session.add_all([project1, project2])
        await db_session.commit()

        # Reload user with eager loading
        query = select(User).where(User.user_id == test_user.user_id).options(selectinload(User.projects))
        result = await db_session.execute(query)
        user_with_projects = result.scalar_one()
        
        assert len(user_with_projects.projects) == 2
        project_names = {p.name for p in user_with_projects.projects}
        assert project_names == {"Project 1", "Project 2"}

    async def test_project_to_files_relationship(
        self, db_session: AsyncSession, test_project: Project
    ):
        """Test project to firmware files relationship."""
        from sqlalchemy.orm import selectinload
        
        # Create multiple files
        file1 = FirmwareFile(
            project_id=test_project.project_id,
            filename="file1.bin",
            size_bytes=1024,
            sha256="e" * 64,
            storage_path="/path/file1.bin",
        )
        file2 = FirmwareFile(
            project_id=test_project.project_id,
            filename="file2.bin",
            size_bytes=2048,
            sha256="f" * 64,
            storage_path="/path/file2.bin",
        )
        db_session.add_all([file1, file2])
        await db_session.commit()

        # Reload project with eager loading
        query = select(Project).where(Project.project_id == test_project.project_id).options(selectinload(Project.files))
        result = await db_session.execute(query)
        project_with_files = result.scalar_one()
        
        assert len(project_with_files.files) == 2
        file_names = {f.filename for f in project_with_files.files}
        assert file_names == {"file1.bin", "file2.bin"}


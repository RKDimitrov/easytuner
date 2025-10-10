# Contributing to EasyTuner

Thank you for your interest in contributing to EasyTuner! This document provides guidelines and instructions for contributing to the project.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Commit Conventions](#commit-conventions)
6. [Testing Requirements](#testing-requirements)
7. [Pull Request Process](#pull-request-process)
8. [Documentation](#documentation)

---

## Code of Conduct

### Our Standards

- **Be respectful**: Treat all contributors with respect and professionalism
- **Be constructive**: Provide helpful feedback and suggestions
- **Be inclusive**: Welcome contributors of all backgrounds and experience levels
- **Be ethical**: Remember this project is for research and education only

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Sharing code or techniques for illegal ECU modification
- Contributing malicious code or vulnerabilities
- Violating intellectual property rights

---

## Getting Started

### Prerequisites

1. Install required tools:
   - Python 3.11+
   - Node.js 18+
   - Docker & Docker Compose
   - Poetry (Python package manager)
   - pnpm (Node.js package manager)
   - Git

2. Fork the repository

3. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/easytuner.git
   cd easytuner
   ```

4. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/your-org/easytuner.git
   ```

5. Install pre-commit hooks:
   ```bash
   pip install pre-commit
   pre-commit install
   ```

### Local Development Setup

See the [README.md](./README.md#quick-start-development) for detailed setup instructions.

---

## Development Workflow

### Branch Strategy (GitFlow)

We use GitFlow for branch management:

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Individual features
- `bugfix/*`: Bug fixes
- `hotfix/*`: Emergency production fixes
- `release/*`: Release preparation

### Creating a Feature Branch

```bash
# Update develop branch
git checkout develop
git pull upstream develop

# Create feature branch
git checkout -b feature/your-feature-name

# Make your changes
# ... work, work, work ...

# Push to your fork
git push origin feature/your-feature-name
```

### Keeping Your Branch Updated

```bash
# Fetch upstream changes
git fetch upstream

# Rebase on develop
git checkout feature/your-feature-name
git rebase upstream/develop

# Resolve conflicts if any
# Then push (may need --force if you rebased)
git push origin feature/your-feature-name --force-with-lease
```

---

## Coding Standards

### Python (Server)

**Style Guide**: PEP 8 with Black formatting

**Tools**:
- **Formatter**: Black (line length: 100)
- **Linter**: Ruff
- **Type Checker**: mypy
- **Import Sorter**: isort

**Example**:
```python
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.models.user import User
from app.schemas.user import UserResponse


async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Get user by ID.
    
    Args:
        user_id: UUID of the user
        db: Database session
        
    Returns:
        User object if found, None otherwise
        
    Raises:
        HTTPException: If user not found
    """
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

**Key Rules**:
- Use type hints for all functions
- Write docstrings for all public functions (Google style)
- Maximum line length: 100 characters
- Use `async`/`await` for I/O operations
- Handle exceptions appropriately
- Log important operations

### TypeScript (Client)

**Style Guide**: Airbnb TypeScript Style Guide

**Tools**:
- **Formatter**: Prettier
- **Linter**: ESLint
- **Type Checker**: TypeScript compiler

**Example**:
```typescript
import React, { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Typography } from '@mui/material';

import { uploadFile } from '@/features/files/filesSlice';
import type { RootState } from '@/store';

interface FileUploaderProps {
  projectId: string;
  onUploadComplete?: (fileId: string) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  projectId,
  onUploadComplete,
}) => {
  const [uploading, setUploading] = useState(false);
  const dispatch = useDispatch();
  
  const handleUpload = useCallback(async (file: File) => {
    try {
      setUploading(true);
      const result = await dispatch(uploadFile({ projectId, file })).unwrap();
      onUploadComplete?.(result.file_id);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  }, [projectId, dispatch, onUploadComplete]);
  
  return (
    <div>
      <Typography variant="h6">Upload Firmware</Typography>
      <Button disabled={uploading} onClick={() => {}}>
        {uploading ? 'Uploading...' : 'Select File'}
      </Button>
    </div>
  );
};
```

**Key Rules**:
- Use functional components with hooks
- Define prop types with TypeScript interfaces
- Use meaningful variable names
- Extract complex logic into custom hooks
- Handle loading and error states
- Use semantic HTML

### SQL (Database)

**Naming Conventions**:
- Tables: `snake_case`, plural (e.g., `users`, `firmware_files`)
- Columns: `snake_case` (e.g., `user_id`, `created_at`)
- Indexes: `idx_table_column` (e.g., `idx_users_email`)
- Foreign keys: Reference primary key name (e.g., `user_id` references `users.user_id`)

**Migration Best Practices**:
- Never modify existing migrations
- Use descriptive migration messages
- Test migrations on production-like data
- Create indexes `CONCURRENTLY` in production
- Include both `upgrade()` and `downgrade()` functions

---

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependencies, config)
- `perf`: Performance improvements
- `ci`: CI/CD changes

### Examples

**Feature**:
```
feat(detection): add 3D map detection algorithm

- Implement volumetric structure recognition
- Add confidence scoring for 3D candidates
- Include unit tests with synthetic data

Closes #123
```

**Bug Fix**:
```
fix(api): correct pagination cursor encoding

The base64 encoding was failing for large offsets.
Changed to use urlsafe_b64encode instead.

Fixes #456
```

**Documentation**:
```
docs(readme): update installation instructions

Added troubleshooting section for common Docker issues.
```

### Commit Message Rules

- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to" not "moves cursor to")
- Keep subject line under 72 characters
- Capitalize subject line
- No period at the end of subject line
- Separate subject from body with blank line
- Wrap body at 72 characters
- Reference issues and PRs in footer

---

## Testing Requirements

### Test Coverage Requirements

- **Server**: Minimum 80% code coverage
- **Client**: Minimum 70% code coverage
- **All new features**: Must include tests

### Server Testing

```bash
cd server
poetry run pytest --cov=app --cov-report=html
```

**Test Structure**:
```
server/tests/
├── unit/           # Unit tests for individual functions
├── integration/    # Integration tests for API endpoints
├── e2e/           # End-to-end workflow tests
└── conftest.py    # Shared fixtures
```

**Example Test**:
```python
import pytest
from httpx import AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_create_project(authenticated_client: AsyncClient):
    """Test project creation endpoint."""
    response = await authenticated_client.post(
        "/api/v1/projects",
        json={
            "name": "Test Project",
            "description": "Test description",
            "is_private": True
        }
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Project"
    assert "project_id" in data
```

### Client Testing

```bash
cd client
npm test
npm run test:coverage
```

**Test Types**:
- **Unit tests**: Jest + React Testing Library
- **Integration tests**: Component interaction tests
- **E2E tests**: Playwright

**Example Test**:
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { FileUploader } from './FileUploader';

describe('FileUploader', () => {
  it('renders upload button', () => {
    render(<FileUploader projectId="123" />);
    expect(screen.getByText(/select file/i)).toBeInTheDocument();
  });
  
  it('shows uploading state', async () => {
    render(<FileUploader projectId="123" />);
    const button = screen.getByText(/select file/i);
    
    fireEvent.click(button);
    expect(await screen.findByText(/uploading/i)).toBeInTheDocument();
  });
});
```

---

## Pull Request Process

### Before Submitting

1. **Run all tests**: Ensure tests pass locally
2. **Run linters**: Fix all linting errors
3. **Update documentation**: If you changed APIs or features
4. **Update CHANGELOG**: Add entry for your changes
5. **Squash commits**: If you have many small commits

### PR Title Format

Use conventional commit format:
```
feat(scope): brief description of changes
```

### PR Description Template

```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to break)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Coverage maintains/improves minimum threshold

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] All checks passing

## Related Issues
Closes #issue_number
```

### Review Process

1. **Automated Checks**: CI/CD must pass
   - Linting
   - Type checking
   - Unit tests
   - Integration tests
   - Coverage thresholds

2. **Code Review**: At least one approval required
   - Review for correctness
   - Review for best practices
   - Review for security issues
   - Review for performance

3. **Merge**: Squash and merge to develop

---

## Documentation

### When to Update Documentation

- Adding new features or APIs
- Changing existing behavior
- Fixing bugs that were unclear in docs
- Adding configuration options

### Documentation Types

1. **Code Comments**: Explain complex logic
2. **Docstrings**: All public functions, classes, modules
3. **README**: High-level project overview
4. **API Docs**: OpenAPI/Swagger (auto-generated)
5. **Architecture Docs**: System design changes
6. **User Guides**: Major feature additions

### Documentation Standards

**Python Docstrings** (Google Style):
```python
def calculate_confidence(features: dict[str, float]) -> float:
    """Calculate confidence score for a candidate.
    
    Args:
        features: Dictionary of feature names to values
        
    Returns:
        Confidence score between 0.0 and 1.0
        
    Raises:
        ValueError: If features dict is empty
        
    Example:
        >>> features = {'gradient': 0.9, 'alignment': 1.0}
        >>> calculate_confidence(features)
        0.85
    """
    pass
```

**JSDoc (TypeScript)**:
```typescript
/**
 * Upload a firmware file to a project
 * @param projectId - UUID of the project
 * @param file - Binary file to upload
 * @returns Promise resolving to file metadata
 * @throws {Error} If upload fails
 */
async function uploadFile(projectId: string, file: File): Promise<FileMetadata> {
  // ...
}
```

---

## Questions or Issues?

- **General questions**: GitHub Discussions
- **Bug reports**: GitHub Issues
- **Feature requests**: GitHub Issues
- **Security issues**: Create a GitHub issue with [SECURITY] tag

---

## Thank You!

Your contributions make EasyTuner better for researchers, educators, and enthusiasts worldwide. We appreciate your time and effort! 🙏


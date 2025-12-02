# Branch Protection Strategy

This document outlines the branching strategy and protection rules for the EasyTuner project.

---

## GitFlow Branching Model

We use the **GitFlow** branching strategy for organized development and releases.

### Branch Structure

```
main (production)
  │
  ├─ develop (integration)
  │   │
  │   ├─ feature/user-authentication
  │   ├─ feature/detection-pipeline
  │   ├─ feature/hex-viewer
  │   └─ ...
  │
  ├─ hotfix/critical-security-fix
  └─ release/v1.0.0
```

---

## Branch Types

### 1. `main` Branch

**Purpose:** Production-ready code only

**Rules:**
- Always deployable
- Only accepts merges from `release/*` and `hotfix/*` branches
- Tagged with version numbers (e.g., `v1.0.0`)
- Automatically deployed to production (via CI/CD)

**Protection Settings:**
- ✅ Require pull request reviews (minimum 2 approvals)
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Require conversation resolution
- ✅ Require signed commits (recommended)
- ✅ Include administrators
- ✅ Restrict who can push (only release managers)
- ✅ Do not allow force pushes
- ✅ Do not allow deletions

### 2. `develop` Branch

**Purpose:** Integration branch for ongoing development

**Rules:**
- Accepts merges from `feature/*` branches
- Source for creating `release/*` branches
- Should be stable (all tests passing)
- Automatically deployed to staging environment

**Protection Settings:**
- ✅ Require pull request reviews (minimum 1 approval)
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Require conversation resolution
- ✅ Do not allow force pushes
- ✅ Do not allow deletions

### 3. `feature/*` Branches

**Purpose:** Individual feature development

**Naming Convention:** `feature/short-descriptive-name`

**Examples:**
- `feature/user-authentication`
- `feature/2d-map-detection`
- `feature/hex-viewer-virtualization`

**Rules:**
- Branch from: `develop`
- Merge back to: `develop`
- Delete after merge
- Naming: lowercase with hyphens

**Protection Settings:**
- None (developers can force push to their own feature branches if needed)

### 4. `bugfix/*` Branches

**Purpose:** Non-critical bug fixes

**Naming Convention:** `bugfix/short-descriptive-name`

**Examples:**
- `bugfix/pagination-cursor-encoding`
- `bugfix/scan-timeout-handling`

**Rules:**
- Branch from: `develop`
- Merge back to: `develop`
- Delete after merge

### 5. `hotfix/*` Branches

**Purpose:** Critical production fixes

**Naming Convention:** `hotfix/issue-description` or `hotfix/v1.0.1`

**Examples:**
- `hotfix/security-jwt-validation`
- `hotfix/v1.0.1`

**Rules:**
- Branch from: `main`
- Merge to: BOTH `main` AND `develop`
- Tagged immediately after merge to `main`
- Delete after merge

### 6. `release/*` Branches

**Purpose:** Release preparation

**Naming Convention:** `release/vX.Y.Z`

**Examples:**
- `release/v1.0.0`
- `release/v1.1.0`

**Rules:**
- Branch from: `develop`
- Merge to: BOTH `main` AND `develop`
- Only bug fixes allowed (no new features)
- Version bumping occurs here
- Delete after merge

---

## Workflow Examples

### Feature Development

```bash
# Start feature
git checkout develop
git pull origin develop
git checkout -b feature/user-authentication

# Work on feature
# ... commits ...

# Keep feature updated
git checkout develop
git pull origin develop
git checkout feature/user-authentication
git rebase develop

# Create PR when ready
git push origin feature/user-authentication
# Open PR: feature/user-authentication → develop
```

### Hotfix

```bash
# Start hotfix
git checkout main
git pull origin main
git checkout -b hotfix/security-jwt-validation

# Fix issue
# ... commits ...

# Merge to main (via PR)
# Tag: v1.0.1

# Also merge to develop
git checkout develop
git pull origin develop
git merge hotfix/security-jwt-validation
git push origin develop

# Delete hotfix branch
git branch -d hotfix/security-jwt-validation
```

### Release

```bash
# Start release
git checkout develop
git pull origin develop
git checkout -b release/v1.0.0

# Bump version, update changelog
# ... commits for release prep only ...

# Merge to main (via PR)
# Tag: v1.0.0

# Also merge to develop
git checkout develop
git pull origin develop
git merge release/v1.0.0
git push origin develop

# Delete release branch
git branch -d release/v1.0.0
```

---

## GitHub Branch Protection Configuration

### Setting Up Protection for `main`

1. Go to: Settings → Branches → Add rule
2. Branch name pattern: `main`
3. Configure:

```yaml
Branch Protection Rules for 'main':
  ☑ Require a pull request before merging
    ☑ Require approvals: 2
    ☑ Dismiss stale pull request approvals when new commits are pushed
    ☑ Require review from Code Owners
    ☑ Require approval of the most recent reviewable push
  
  ☑ Require status checks to pass before merging
    ☑ Require branches to be up to date before merging
    Required status checks:
      - backend-tests
      - frontend-tests
      - lint-backend
      - lint-frontend
      - security-scan
      - build
  
  ☑ Require conversation resolution before merging
  
  ☑ Require signed commits
  
  ☑ Require linear history
  
  ☑ Lock branch (read-only, except via PR)
  
  ☑ Do not allow bypassing the above settings
  
  ☑ Restrict who can push to matching branches
    People/Teams: release-managers
  
  ☑ Allow force pushes: Never
  
  ☑ Allow deletions: Never
```

### Setting Up Protection for `develop`

1. Go to: Settings → Branches → Add rule
2. Branch name pattern: `develop`
3. Configure:

```yaml
Branch Protection Rules for 'develop':
  ☑ Require a pull request before merging
    ☑ Require approvals: 1
    ☑ Dismiss stale pull request approvals when new commits are pushed
  
  ☑ Require status checks to pass before merging
    ☑ Require branches to be up to date before merging
    Required status checks:
      - backend-tests
      - frontend-tests
      - lint-backend
      - lint-frontend
      - security-scan
  
  ☑ Require conversation resolution before merging
  
  ☑ Require linear history
  
  ☑ Do not allow bypassing the above settings
  
  ☑ Allow force pushes: Never
  
  ☑ Allow deletions: Never
```

---

## Status Checks Required

All protected branches require these CI/CD checks to pass:

### Backend Checks
- **backend-tests**: Unit and integration tests (`pytest`)
- **backend-coverage**: Code coverage ≥80%
- **lint-backend**: Linting (`ruff`, `black`, `isort`)
- **type-check-backend**: Type checking (`mypy`)

### Frontend Checks
- **frontend-tests**: Unit tests (`jest`)
- **frontend-coverage**: Code coverage ≥70%
- **lint-frontend**: Linting (`eslint`)
- **type-check-frontend**: Type checking (`tsc --noEmit`)
- **build-frontend**: Production build succeeds

### Security Checks
- **security-scan**: Dependency vulnerability scan
- **secret-detection**: No secrets in code

### Documentation
- **docs-build**: Documentation builds successfully

---

## Pull Request Requirements

### All Pull Requests Must:

1. ✅ Pass all required status checks
2. ✅ Have descriptive title following conventional commits
3. ✅ Include complete PR description (use template)
4. ✅ Link related issues
5. ✅ Have appropriate labels
6. ✅ Resolve all review comments
7. ✅ Update documentation if needed
8. ✅ Include tests for new features
9. ✅ Maintain or improve code coverage

### PR Title Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

Examples:
- feat(auth): add JWT token refresh endpoint
- fix(detection): correct 2D map boundary detection
- docs(api): update authentication endpoints
- refactor(frontend): extract hex viewer to component
- test(backend): add scan pipeline integration tests
```

---

## Code Owners

Create a `.github/CODEOWNERS` file:

```
# Global code owners
* @easytuner/engineering-leads

# Backend
/backend/ @easytuner/backend-team
/backend/app/detection/ @easytuner/detection-team

# Frontend
/frontend/ @easytuner/frontend-team

# Infrastructure
/.github/ @easytuner/devops-team
/docker-compose.yml @easytuner/devops-team
/k8s/ @easytuner/devops-team

# Documentation
/docs/ @easytuner/documentation-team

# Security-sensitive files
.env.example @easytuner/security-team
/backend/app/auth/ @easytuner/security-team
```

---

## Emergency Procedures

### Breaking the Build on `main`

1. **Immediate rollback**: Revert the problematic commit
2. **Create hotfix branch**: Fix the issue properly
3. **Incident report**: Document what happened and why
4. **Post-mortem**: Review process to prevent recurrence

### Reverting a Merge

```bash
# Find the merge commit
git log --oneline --graph

# Revert the merge (use -m 1 for first parent, usually main/develop)
git revert -m 1 <merge-commit-hash>

# Push the revert
git push origin main  # or develop
```

---

## Branch Lifecycle

### Creating Branches

```bash
# Feature
git checkout -b feature/my-feature develop

# Bugfix
git checkout -b bugfix/my-bugfix develop

# Hotfix
git checkout -b hotfix/critical-fix main

# Release
git checkout -b release/v1.0.0 develop
```

### Updating Branches

```bash
# Rebase on develop (recommended)
git fetch origin
git rebase origin/develop

# Or merge (if rebase is problematic)
git fetch origin
git merge origin/develop
```

### Cleaning Up

```bash
# Delete local branch
git branch -d feature/my-feature

# Delete remote branch (after merge)
git push origin --delete feature/my-feature

# Prune deleted remote branches
git fetch --prune
```

---

## Version Tagging

### Semantic Versioning

We follow [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR.MINOR.PATCH** (e.g., `v1.2.3`)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Creating Tags

```bash
# Annotated tag (recommended)
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# List tags
git tag -l

# Tag specific commit
git tag -a v1.0.1 <commit-hash> -m "Hotfix release 1.0.1"
```

---

## Enforcement

Branch protection rules are **strictly enforced**. Violations will:

1. Block the merge
2. Trigger automated notifications
3. Require administrator override (logged and reviewed)

**No exceptions** without documented approval from:
- Engineering Lead
- Security Team (for security-related changes)
- Product Owner (for emergency releases)

---

## References

- [GitFlow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

---

**Last Updated:** October 10, 2025  
**Maintained By:** DevOps Team


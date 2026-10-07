# Sample API

A simple Node.js sample API demonstrating a professional Git workflow.

## Branching Strategy

* `main` — stable and release-ready code.
* `develop` — integration branch for completed features.
* `feature/<name>` — feature development branches created from `develop`.

### Workflow

```text
feature/<name> → develop → main
```

Changes are reviewed through pull requests before merging.

## Git Commands Used

```bash
git switch develop
git switch -c feature/api-info
git add .
git commit -m "feat: add info endpoint"
git commit -m "feat: update info response"
git push -u origin feature/api-info

git fetch origin
git merge origin/develop
git add app.js
git commit -m "fix: resolve merge conflict"
git push

git switch main
git pull
git tag -a v1.0.1 -m "Release v1.0.1"
git push origin v1.0.1
```

## API Endpoints

* `/health` — Health check
* `/version` — API version
* `/info` — API information


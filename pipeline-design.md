# Pipeline Design Proposal: `sample-api`

**Prepared for:** Team Lead\
**Application:** Containerised Node.js `sample-api`\
**Repository:** `sample-api`\
**Status:** Proposed design

## 1. Overview and objectives

This proposal defines a controlled CI/CD pipeline for the containerised
`sample-api` service. The pipeline validates every proposed change,
creates a versioned Docker image, publishes the image to Docker Hub, and
promotes the **same image digest** through development, staging, and
production. Production deployment is protected by a manual approval
gate.

The repository currently contains `app.js`, `test.js`, `package.json`,
`package-lock.json`, `Dockerfile`, and a Jenkinsfile. The application
exposes `/health`, `/version`, and `/info`. The local lab script
(`pipeline.sh`) is useful for learning stage order and fail-fast
behaviour; Jenkins is the proposed automation platform for team use.

### Design principles

-   Fail fast: a failed mandatory stage prevents promotion.
-   Build once, deploy many: do not rebuild an image separately for each
    environment.
-   Immutable releases: tag images with the Git commit SHA and promote
    by digest.
-   Least privilege: pipeline jobs receive only the permissions needed
    for their task.
-   Safe production release: approval, health checks, monitoring, and
    rollback are required.

## 2. Pipeline diagram

The source diagram is provided separately as `pipeline-diagram.mmd`
(Mermaid). It can be rendered in Mermaid-compatible Markdown tools or
recreated in draw.io/Excalidraw.

``` mermaid
flowchart TD
    A[Developer commits to feature branch] --> B[Pull request opened or updated]
    B --> C[Checkout and validate source]
    C --> D[Install locked dependencies: npm ci]
    D --> E[Quality and security checks]
    E --> F[Unit and integration tests]
    F --> G{All PR checks pass?}
    G -- No --> H[Fail PR checks; notify author]
    G -- Yes --> I[Review and merge to main]
    I --> J[Build Docker image once]
    J --> K[Tag with commit SHA]
    K --> L[Scan image and publish to Docker Hub]
    L --> M[Deploy exact image to dev]
    M --> N[Health and smoke tests]
    N --> O[Deploy exact image to staging]
    O --> P[Staging smoke tests and release validation]
    P --> Q{Production approval}
    Q -- Rejected --> R[Stop promotion; retain current production]
    Q -- Approved --> S[Rolling production deployment]
    S --> T[Health checks and monitoring]
    T --> U{Healthy?}
    U -- Yes --> V[Release complete; notify team]
    U -- No --> W[Rollback to previous image; alert team]
```

## 3. Source control and triggers

Use a lightweight feature-branch workflow:

-   `feature/<short-description>`: development work and small changes.
-   Pull request into `main`: mandatory checks run before merge.
-   `main`: protected branch; require review and passing checks.
-   Version tag such as `v1.2.0`: marks an approved release and can be
    used for release notes.

  -----------------------------------------------------------------------
  Event                               Pipeline behaviour
  ----------------------------------- -----------------------------------
  Pull request opened, updated, or    Checkout, dependency installation,
  reopened                            lint/static checks, secret scan,
                                      dependency audit, unit/integration
                                      tests, and Docker build validation.
                                      Do not publish a production image
                                      or deploy.

  Push/merge to `main`                Repeat mandatory checks, build the
                                      release image once, scan it,
                                      publish it to Docker Hub, then
                                      deploy to dev and staging.

  Version tag (`vX.Y.Z`)              Validate the tag against the
                                      commit, associate the semantic
                                      version with the already-built
                                      image, and start the
                                      release/approval workflow. Avoid
                                      rebuilding different bytes for the
                                      same release.

  Manual production approval          Promote the exact image digest that
                                      passed staging.

  Scheduled security run (optional)   Re-check dependencies and
                                      base-image vulnerabilities and
                                      create a ticket or alert for new
                                      findings.
  -----------------------------------------------------------------------

Protect `main` with required pull-request review and status checks. Do
not allow unreviewed changes to deploy directly to production.

## 4. Build and automated tests

Run in a clean CI workspace using the Node.js 20 runtime and the
lockfile:

``` bash
npm ci
npm test
```

The existing test script is `node test.js`. It starts the application on
port `3055` and checks that `GET /health` returns `OK`.

Recommended checks to add as the project grows:

``` bash
# Add a lint script and a linter such as ESLint to package.json first
npm run lint

# Dependency audit
npm audit --audit-level=high

# Build the container image
docker build -t sample-api:${GIT_COMMIT} .
```

Test types:

-   **Static/lint:** catches style errors and common code defects before
    execution. The `lint` command is a proposed addition; it will not
    work until a linter and script are configured.
-   **Unit test:** verifies application behaviour, beginning with the
    existing `/health` assertion.
-   **Integration/smoke test:** starts the built container and calls
    `/health` (and, where appropriate, `/version`) over HTTP.
-   **Container build test:** ensures the Dockerfile can build
    successfully from the committed source.

A stage fails if its command exits non-zero, a required endpoint returns
an unexpected status/body, or a mandatory security policy is breached.
Jenkins should stop downstream stages after such a failure and mark the
run failed.

## 5. Image publishing and release identity

**Registry:** Docker Hub, matching the repository's current Jenkinsfile
configuration.

**Image naming:**

-   Commit tag: `vibhord/sample-api:<full-commit-sha>`
-   Optional release tag: `vibhord/sample-api:v1.2.0`
-   Optional convenience tag: `vibhord/sample-api:main` (not used as the
    immutable deployment identity)

Use a full Git commit SHA in the published image tag. After publishing,
record the registry image digest (`sha256:...`) and deploy by digest
where the deployment platform supports it. A mutable tag such as
`latest` or `main` must not be the only release identifier.

**Build once, deploy many:** build and scan one image from the merge
commit, publish it, then deploy that same digest to dev, staging, and
production. Environment-specific values are injected at runtime; the
image itself is not rebuilt for each environment. This reduces drift and
makes rollback to a known image possible.

## 6. Deployment and production strategy

### Environments

-   **Dev:** automatic deployment after the image is published. Run
    basic health and smoke checks.
-   **Staging:** automatic promotion after dev checks pass. Use
    production-like configuration and run smoke tests plus release
    validation.
-   **Production:** requires a manual approval after staging succeeds.
    Deploy the exact image digest that passed validation.

### Production strategy: rolling deployment

Use a rolling deployment where the runtime platform supports multiple
application instances behind a load balancer. Replace instances
gradually, verify readiness/health checks, and keep enough healthy
capacity to serve traffic during rollout. This is a practical default
for a small stateless HTTP API because it avoids maintaining a fully
separate blue/green environment while reducing downtime risk.

If the current host can run only one instance, a true rolling deployment
is not available without first adding multiple instances and a load
balancer. In that case, document the limitation and use a controlled
restart with a tested rollback procedure until the platform is upgraded.

The approval gate sits **after staging validation and before production
deployment**. The approver verifies the change summary, image
SHA/digest, test and scan results, staging health, deployment window,
and rollback target.

## 7. Secrets, configuration, and permissions

### Secrets

-   Store Docker Hub credentials in Jenkins Credentials (credential ID
    such as `dockerhub-credentials`), never in the repository,
    Dockerfile, or console output.
-   Use separate credentials for deployment environments when required.
-   Use a managed secret store for runtime secrets in a real deployment
    (for example, AWS Secrets Manager or the platform's secret
    facility).
-   Mask credentials in logs, disable shell tracing around secrets,
    rotate tokens, and use scoped tokens rather than personal passwords.

### Environment configuration

Keep non-secret configuration separate by environment, for example
`dev`, `staging`, and `prod` variables. Inject values at deploy time
rather than baking them into the image. Store secrets separately and
never commit `.env` files containing real credentials.

### Least privilege

-   CI/test stage: read source and install dependencies; no production
    deployment permissions.
-   Registry stage: push only to the `sample-api` repository.
-   Dev/staging deploy identity: deploy only to its assigned
    environment.
-   Production deploy identity: available only to the protected
    production job after approval.
-   Limit who can approve production; ideally the approver is a
    designated release manager or engineer other than the change author.

## 8. Quality and security checks

At least these checks should be part of the pipeline:

1.  **Dependency vulnerability scan:** `npm audit --audit-level=high`.
    Fail or require an approved exception for high/critical findings
    according to team policy.
2.  **Container image scan:** use Trivy, for example
    `trivy image --severity HIGH,CRITICAL --exit-code 1 <image>`. Run
    after image build and before publishing/promotion, or scan the exact
    published image.
3.  **Secret scan:** use Gitleaks to detect accidentally committed
    credentials. Fail the PR if a new verified secret is found; revoke
    exposed credentials immediately.
4.  **Static analysis/lint:** add ESLint and run `npm run lint`. This is
    a proposed check because the current `package.json` does not yet
    define a lint script.
5.  **Automated tests and HTTP health checks:** require tests to pass
    and `/health` to return the expected response before promotion.

Security tools and commands must be pinned to approved versions in the
actual Jenkins environment. Define a documented exception process so a
known finding cannot be silently ignored.

## 9. Failure handling, notifications, and rollback

  -----------------------------------------------------------------------
  Failure                             Required response
  ----------------------------------- -----------------------------------
  Dependency installation, lint, or   Stop immediately; mark build
  tests fail                          failed; report stage and logs; do
                                      not publish or deploy.

  Secret/dependency/image scan fails  Block publication or promotion;
                                      notify the repository
                                      owner/security contact; fix or
                                      formally approve a time-bound
                                      exception.

  Image push fails                    Stop deployment; retry only for
                                      transient registry/network errors;
                                      do not deploy an unverified local
                                      image.

  Dev or staging deployment/health    Stop promotion; capture
  check fails                         container/service logs and
                                      health-check output; leave
                                      production unchanged.

  Production deployment fails or      Halt rollout, route traffic only to
  health degrades                     healthy instances, roll back to the
                                      previous known-good image digest,
                                      and alert the on-call owner.

  Production approval rejected or     Do not deploy; retain the currently
  times out                           running production version and
                                      record the decision.
  -----------------------------------------------------------------------

After each deployment, check container/service readiness and the
`/health` endpoint. Production monitoring should also include error
rate, latency, and restart count. Notifications should include the build
URL, commit SHA, failed stage, concise error, and responsible team;
never include secrets.

Retain the previous known-good image and deployment configuration for
rollback. A rollback is a redeployment of the previous image digest, not
a rebuild of old source code.

## 10. Evidence and submission checklist

Attach real screenshots from the hands-on lab. Do not use fabricated or
recreated terminal output as evidence.

-   [ ] Passing `npm test` output showing `PASS: /health returns OK` and
    exit code `0`.
-   [ ] Successful local pipeline showing build, tests, Docker image
    creation, and dev health check.
-   [ ] Docker image list showing the commit-SHA tag.
-   [ ] Deliberately failing run after changing `/health` from `OK` to
    `BROKEN`, showing the assertion failure and that
    packaging/deployment did not run.
-   [ ] Fixed run after restoring `OK`, showing successful tests and
    deployment health checks.
-   [ ] Production approval prompt showing the simulated approval gate.

### Deliverables

1.  This design document: `pipeline-design.md`.
2.  Diagram source: `pipeline-diagram.mmd`.
3.  Repository containing `pipeline.sh`, `test.js`, and the design
    files.
4.  Evidence screenshots attached to the submission or stored in an
    `evidence/` folder.

**Repository URL:** Add the actual GitHub repository URL here before
submission: `https://github.com/<your-username>/<your-repository>`.

**Implementation note:** The current repository already has `test.js`,
`package.json`, `Dockerfile`, and a Jenkinsfile. The local `pipeline.sh`
is a teaching script. The production controls in this document are the
proposed team design and should not be described as implemented until
they are configured and tested.

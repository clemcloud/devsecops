# CI/CD Security Pipeline

This document explains `.github/workflows/ci.yml` — what it does, why each stage exists, and what security problem it defends against. The pipeline runs on every push and pull request, and enforces that **nothing insecure reaches ECR or the running application** without passing through it first.

## Trigger

```yaml
on:
  push:
    branches: ["*"]
  pull_request:
    branches: ["*"]
```

Runs on every push to any branch and every pull request. Image build/push only happens on actual pushes (not PRs) — see Stage 7.

## Permissions

```yaml
permissions:
  contents: read
```

Default permission for the whole workflow is read-only. Only the final manifest-update stage explicitly elevates to `contents: write`, and only for that one job — least privilege by default.

---

## Stage 1 — Lint (`lint`)

Runs `flake8` against the backend code. Catches basic style and syntax issues early. Set to `continue-on-error: true` — a style issue shouldn't block the whole pipeline, but it's visible in the run output.

**What it defends against:** not a security stage on its own, but a fast first check that avoids wasting time on later, more expensive stages if the code doesn't even lint cleanly.

## Stage 2 — Secrets Scan (`secrets-scan`)

Runs **gitleaks** against the full commit history (`fetch-depth: 0` — pulls all history, not just the latest commit, since a secret could have been committed and later removed but still exist in history).

**What it defends against:** accidentally committed credentials — API keys, database passwords, JWT secrets — reaching the public repo. This is a hard gate; no `continue-on-error`. If it fails, the pipeline stops.

## Stage 3 — SAST (`sast`)

Runs **Bandit** against the backend's Python code, looking for insecure coding patterns: hardcoded secrets, SQL injection risk, unsafe deserialization, weak cryptography. Report is saved as a downloadable artifact.

**What it defends against:** vulnerabilities introduced in the application's own code, before they ever reach a running container.

## Stage 4 — SCA (`sca`)

Runs **pip-audit** against `requirements.txt`, checking every dependency (and transitive dependency) against known CVE databases.

**What it defends against:** known-vulnerable third-party packages. This is a hard gate — a genuinely vulnerable dependency stops the pipeline, since it's an objective, well-defined risk rather than a style judgment call.

## Stage 5 — Dockerfile Lint (`dockerfile-lint`)

Runs **Hadolint** against both `backend/Dockerfile` and `frontend/Dockerfile` (via a matrix — one job definition, run twice automatically).

**What it defends against:** bad Dockerfile practices that increase attack surface or break reproducibility — e.g., unpinned base image versions, unnecessary packages, missing cleanup steps.

## Stage 6 — IaC Scan (`iac-scan`)

Runs **Checkov** against the Terraform code, checking for infrastructure misconfigurations: overly permissive security groups, unencrypted resources, public exposure that shouldn't be public.

**What it defends against:** insecure infrastructure being provisioned in the first place — the same category of tool as Trivy, but for infrastructure-as-code instead of container images.

## Stage 7 — Build, Scan, Push (`build-scan-push`)

The core of the pipeline. Depends on **every** stage above passing (`needs: [secrets-scan, sast, sca, dockerfile-lint, iac-scan]`) — nothing here runs unless the code, dependencies, Dockerfiles, and infrastructure have all been checked first.

Runs as a matrix across `[backend, frontend]` — both build in parallel.

Steps, in order:
1. **Authenticate to AWS** using credentials stored as GitHub Secrets (never hardcoded in the workflow)
2. **Log in to ECR**
3. **Build the image**, tagged with the commit's short SHA — every build is traceable to the exact commit that produced it
4. **Trivy scan** the freshly built image for OS and package vulnerabilities. `exit-code: "1"` with `severity: "CRITICAL,HIGH"` means: if a critical or high vulnerability is found, **this step fails and the image is never pushed**
5. **Tag and push** — only reached if the Trivy scan passed. Pushes both the commit-SHA tag (specific, traceable) and `latest` (convenient pointer). Skipped entirely on pull requests (`if: github.event_name != 'pull_request'`) — PRs get built and scanned to verify they're safe, but nothing is pushed until it's actually merged.

**What it defends against:** this is the actual security gate for container images — an image with a critical vulnerability physically cannot reach ECR through this pipeline.

## Stage 8 — Update Kubernetes Manifest (`update-manifest`)

Only runs on a real push to `main` (never on PRs): `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`.

After a successful build and push, this stage:
1. Checks out the repo with write access
2. Uses `sed` to replace the image tag in `k8s/manifest.yaml` with the new commit SHA, for both backend and frontend
3. Commits and pushes that change back to the repo, using a bot identity, with `[skip ci]` in the commit message to avoid triggering the pipeline again in a loop

**What it achieves:** the Kubernetes manifest always reflects the exact image that just passed every security check — no manual editing, no risk of deploying a stale or unverified tag. Deployment to the cluster (`kubectl apply -f k8s/manifest.yaml`) is still a manual step in this project; a tool like Argo CD would be the next step to make that automatic too, but wasn't implemented here.

---

## The overall shape

```
lint ─┐
      ├─→ secrets-scan ─┐
      ├─→ sast          ├─→ build-scan-push (backend + frontend, parallel)
      ├─→ sca            │        ↓
      ├─→ dockerfile-lint│   update-manifest (push to main only)
      └─→ iac-scan ──────┘
```

Every image that reaches ECR, and every manifest that reflects a deployable image, has passed: a lint check, a secrets scan, a static code scan, a dependency vulnerability check, a Dockerfile lint, an infrastructure scan, and a container image vulnerability scan — in that order, with the build stage itself gated behind all of them.

## Required GitHub Secrets

Set under **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|---|---|
| `AWS_ACCESS_KEY_ID` | Authenticates GitHub Actions to AWS |
| `AWS_SECRET_ACCESS_KEY` | Authenticates GitHub Actions to AWS |
| `AWS_ACCOUNT_ID` | Used to construct the ECR registry URL |
| `AWS_REGION` | AWS region for ECR/EKS |

None of these are stored in the repository itself.
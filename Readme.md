# Task Tracker — DevSecOps Project

A three-tier task management application (FastAPI + PostgreSQL + HTML/JS frontend), built to demonstrate a full DevSecOps pipeline: containerization, infrastructure as code, Kubernetes deployment, and automated security scanning in CI/CD.

## Tech Stack

- **Backend:** Python, FastAPI, SQLAlchemy, JWT auth
- **Database:** PostgreSQL
- **Frontend:** HTML, CSS, vanilla JavaScript, served via nginx
- **Containerization:** Docker (multi-stage builds, non-root users)
- **Infrastructure:** Terraform (AWS VPC + EKS, Auto Mode)
- **Orchestration:** Kubernetes (EKS)
- **CI/CD:** GitHub Actions — see `SECURITY-PIPELINE.md` for full pipeline breakdown

## Features

- User registration and login (JWT auth)
- Authenticated users can create, view, update, and delete their own tasks
- Task ownership enforced at the database query level
- Hardened containers: non-root users, minimal base images, dropped Linux capabilities
- NetworkPolicies restricting pod-to-pod traffic (frontend → backend → db only)

## Architecture

![Architecture Diagram](./architecture-diagram.png)

The pipeline: code is pushed to GitHub → GitHub Actions runs linting, secrets scanning, SAST, SCA, Dockerfile linting, and IaC scanning → on success, images are built, scanned with Trivy, and pushed to Amazon ECR → Kubernetes manifests are updated with the new image tag → the app runs on an EKS cluster (provisioned via Terraform), with NetworkPolicies restricting traffic to frontend → backend → database only. See `SECURITY-PIPELINE.md` for the full breakdown of each CI stage.

---

## Running Locally (no Docker)

Useful for development and debugging the app directly.

### Prerequisites
- Python 3.11+
- PostgreSQL installed locally

### Steps

```bash
git clone <your-repo-url>
cd devsecops

# Start Postgres
sudo service postgresql start

# Create DB and user (first time only)
sudo -u postgres psql
#   CREATE USER taskuser WITH PASSWORD 'your_password_here';
#   CREATE DATABASE taskdb OWNER taskuser;
#   \q

cd backend

# Create .env with:
#   DATABASE_URL=postgresql://taskuser:your_password_here@localhost:5432/taskdb
#   SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
#   ALGORITHM=HS256
#   ACCESS_TOKEN_EXPIRE_MINUTES=30

python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API: **http://localhost:8000** — Docs: **http://localhost:8000/docs**

In a second terminal:
```bash
cd frontend
python -m http.server 5500
```

Frontend: **http://localhost:5500**

---

## Running Locally (Docker Compose)

Runs the full three-tier stack in containers — closer to production.

### Prerequisites
- Docker + Docker Compose

### Setup

Create a `.env` at the project root:
```env
DB_USER=taskuser
DB_PASSWORD=your_real_password
DB_NAME=taskdb
SECRET_KEY=your_generated_secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### Run

```bash
docker compose up --build
```

- Backend: **http://localhost:8000/docs**
- Frontend: **http://localhost:5500**

`docker compose down` stops everything; add `-v` to also wipe the database volume.

---

## Running in Production (AWS EKS)

### Infrastructure

Provisioned via Terraform — VPC, EKS cluster (Auto Mode), IAM permissions.

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

Outputs include the cluster name and endpoint. Configure `kubectl`:
```bash
aws eks update-kubeconfig --region <region> --name <cluster_name>
kubectl get nodes
```

### Images

Backend and frontend are built as hardened, multi-stage Docker images (non-root users, minimal base images) and pushed to two separate ECR repositories.

```bash
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

docker build -t devsecops-backend:latest ./backend
docker tag devsecops-backend:latest <account-id>.dkr.ecr.<region>.amazonaws.com/devsecops-backend:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/devsecops-backend:latest

docker build -t devsecops-frontend:latest ./frontend
docker tag devsecops-frontend:latest <account-id>.dkr.ecr.<region>.amazonaws.com/devsecops-frontend:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/devsecops-frontend:latest
```

In CI, this build → scan → push flow happens automatically on every push to `main` — see `SECURITY-PIPELINE.md`.

### Deploy to Kubernetes

```bash
kubectl apply -f k8s/backend-secret.yaml   # not committed — see below
kubectl apply -f k8s/manifest.yaml
```

Watch rollout:
```bash
kubectl get pods -n devsecops -w
```

Access the app:
```bash
kubectl port-forward svc/frontend 8080:80 -n devsecops
```
Then open **http://localhost:8080**.

### The Secret file

`k8s/backend-secret.yaml` holds the database URL and JWT signing key and is **never committed** to this repo. Create it locally with your real values before deploying:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: backend-secrets
  namespace: devsecops
type: Opaque
stringData:
  DATABASE_URL: "postgresql://<user>:<password>@db:5432/<dbname>"
  SECRET_KEY: "<your-generated-secret>"
  ALGORITHM: "HS256"
  ACCESS_TOKEN_EXPIRE_MINUTES: "30"
```

The password here must match the `POSTGRES_PASSWORD` set in the `db` Deployment inside `k8s/manifest.yaml`.

---

## Project Structure

```
devsecops/
├── .github/workflows/ci.yml     # CI/CD pipeline — see SECURITY-PIPELINE.md
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── auth.py
│   │   └── routers/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env                     (gitignored)
├── frontend/
│   ├── index.html
│   ├── script.js
│   ├── nginx.conf
│   └── Dockerfile
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── providers.tf
│   └── terraform.tfvars         (gitignored)
├── k8s/
│   ├── manifest.yaml
│   └── backend-secret.yaml      (gitignored)
├── docker-compose.yml
└── .env                         (gitignored — used by docker-compose)
```

## Security Design Notes

- **Non-root containers** — both backend and frontend run as non-root users with explicit numeric UIDs (required for Kubernetes' `runAsNonRoot` enforcement)
- **Dropped Linux capabilities** — containers run with all capabilities dropped by default
- **Read-only root filesystem** — backend's container filesystem is read-only at runtime
- **NetworkPolicies** — the database only accepts traffic from backend pods; backend only accepts traffic from frontend pods
- **Secrets never committed** — `.env` files and `k8s/backend-secret.yaml` are gitignored; CI reads credentials from GitHub Secrets
- **Multi-stage Docker builds** — build tools and package caches never ship in the final image


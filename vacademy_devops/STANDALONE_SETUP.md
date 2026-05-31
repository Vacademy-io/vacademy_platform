# Vacademy Standalone Setup (single server)

Deploy the whole Vacademy stack on **one Linux server** using k3s (single-node
Kubernetes). One install, pick the services you need, your own domain with
automatic HTTPS. This is for client/standalone deployments — cloud production
uses the same chart with the managed DB (see `DEPLOYMENT_GUIDE.md`).

## What you get

- Mandatory services: **auth, admin-core, media** (always on)
- Optional (toggle at install): **assessment, ai, notification, community**
  - ⚠️ `notification` is required for email/WhatsApp **OTP login**. Password and
    Google/GitHub OAuth login work without it.
- Bundled **PostgreSQL** (schema auto-loaded from prod baselines) + **Redis**
- Both **frontends** (admin + learner) served with automatic Let's Encrypt TLS

## 1. Server sizing

| Tier | Services | Minimum VM |
|---|---|---|
| Mandatory | auth + admin-core + media + DB + Redis + frontends | **4 vCPU / 8 GB / 60 GB SSD** |
| Full | + assessment + ai + notification + community | **8 vCPU / 16 GB / 80 GB SSD** |

`ai-service` alone wants ~3 GB (Whisper) — that's what pushes the full tier to 16 GB.
Ubuntu 22.04+ (or any systemd Linux). Outbound internet needed to pull images.

## 2. DNS

Create two **A-records** pointing at the server's public IP (the installer prints
the exact lines with your IP at the end):

```
admin.<your-domain>   ->  <server-ip>     # admin dashboard
app.<your-domain>     ->  <server-ip>     # learner app + API
```

TLS is issued automatically by Let's Encrypt once DNS resolves — no manual certs.

## 3. Install

```bash
git clone <this-repo> && cd vacademy_platform/vacademy_devops
sudo ./install.sh
```

The wizard installs k3s + Helm + cert-manager, then asks for:
- your base domain and a Let's Encrypt email
- which optional services to enable
- your own cloud keys — **AWS S3** (required for media); OpenRouter (if ai);
  SES/SQS and OAuth can be filled later in `vacademy-services/values.secret.yaml`

DB / JWT / app passwords are auto-generated per install. It then deploys and
prints the DNS records and how to watch the rollout.

> Bring your own keys: S3 (media), SES (email/OTP), OpenRouter/Gemini (AI), and
> Google/GitHub OAuth apps are **per-client** — create them in your own cloud
> accounts. OAuth redirect URIs must use `https://admin.<domain>/login/oauth2/...`.

## 4. Verify

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get pods                 # all Running/Completed
kubectl get certificate          # READY=True once DNS resolves
kubectl logs job/postgres-baseline-load   # schema load (one-time)
```

Then open `https://admin.<domain>` and `https://app.<domain>`.

## 5. Change which services run

Edit `services.<name>.enabled` in `vacademy-services/values.secret.yaml`, then:

```bash
sudo ./install.sh        # reuse existing secret file when prompted
```

## 6. Backups

The bundled Postgres holds all data — back it up:

```bash
sudo ./backup.sh                 # dumps all DBs to ./backups/<timestamp>/
# schedule daily at 02:00:
echo '0 2 * * * root /opt/vacademy_devops/backup.sh >> /var/log/vacademy-backup.log 2>&1' \
  | sudo tee /etc/cron.d/vacademy-backup
```

Keeps the 14 most recent backups. (If you later switch to a managed DB, back it
up at the provider instead.)

## 7. Upgrades

Each release pins specific image tags for determinism. To upgrade:

```bash
sudo ./update.sh <release-tag>   # e.g. ./update.sh v1.18.0
```

It backs up first, then `helm upgrade`. The baseline loader only touches **empty**
databases, so your data is safe; new schema migrations bundled in the images
apply automatically on service startup (Flyway).

## 8. Troubleshooting

| Symptom | Check / fix |
|---|---|
| Pods `Pending` | `kubectl describe pod <p>` — usually not enough RAM/CPU; size up the VM. |
| `certificate` not READY | DNS must resolve to this server first; `kubectl describe certificate`. |
| A service `CrashLoopBackOff` | `kubectl logs <pod>` — often a missing key in `values.secret.yaml` (e.g. S3 for media). |
| OTP login fails | Enable `notification_service` and set SES creds, or use password/OAuth login. |
| `postgres-baseline-load` failing | `kubectl logs job/postgres-baseline-load`; ensure the bundled DB pod is Running. |

## Architecture notes

- Services connect **directly** to the bundled Postgres (`postgres:5432`) — PgBouncer
  is only used in cloud prod with the managed DB.
- The env **source of truth** is the chart's `configmap.yaml` (non-secret) +
  `secret-env.yaml` (secret), rendered from `values*.yaml`. Both are mounted on
  every service via `envFrom`.
- Frontends are served at the root of their subdomain; the API path-prefixes
  (`/auth-service`, …) are routed on the **same** subdomain, so the SPA is
  same-origin with the backend (no per-client rebuild).

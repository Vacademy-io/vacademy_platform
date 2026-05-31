# Hetzner Production Topology

Concrete topology for the Linode → Hetzner Singapore migration. Every script in
this directory references the names and IPs below as its source of truth.

## Boxes

| Role | Hetzner name | Type | Specs | Public IP | Private IP |
|---|---|---|---|---|---|
| **k3s-node-1** | ubuntu-16gb-sin-1 | CCX23 | 4 vCPU AMD ded / 16 GB / 160 GB NVMe | `5.223.88.202` | `10.0.0.2` |
| **k3s-node-2** | ubuntu-16gb-sin-2 | CCX23 | 4 vCPU AMD ded / 16 GB / 160 GB NVMe | `5.223.54.6`   | `10.0.0.3` |
| **k3s-node-3** | ubuntu-16gb-sin-3 | CCX23 | 4 vCPU AMD ded / 16 GB / 160 GB NVMe | `5.223.55.238` | `10.0.0.6` |
| **db-primary** | ubuntu-8gb-sin-1  | CCX13 | 2 vCPU AMD ded / 8 GB / 80 GB NVMe   | `5.223.55.54`  | `10.0.0.4` |
| **db-standby** | ubuntu-4gb-sin-1  | **CPX22** | 3 vCPU Intel **shared** / 4 GB / 80 GB NVMe | `5.223.53.24`  | `10.0.0.5` |

> **CPX22 standby trade-off:** half the RAM of primary, shared CPU.
> Replication keeps up fine (low WAL volume). **On failover**, query perf drops
> until you resize CPX22 → CCX13 (~5 min reboot). Accept this for ~$21/mo savings.

## Private network

- Hetzner Cloud Network: `vacademy-prod-sin`, CIDR `10.0.0.0/16`
- Subnet: `10.0.0.0/24`
- All 5 boxes attached
- IP plan: `.10` block = k3s nodes, `.20` block = DB nodes (room to grow)

**All intra-cluster traffic uses private IPs** — k3s API, etcd, kubelet, Postgres
replication, pgBackRest. Public IPs only for SSH (until we add a bastion later)
and the k3s ingress LB.

## Hetzner Cloud Firewalls

| Firewall | Attached to | Inbound rules |
|---|---|---|
| `fw-k3s` | k3s-node-1/2/3 | 22 (your IPs), 80/443 (any), ICMP (any). **All TCP from `10.0.0.0/16`** (intra-cluster). |
| `fw-db`  | db-primary, db-standby | 22 (your IPs), **5432 from `10.0.0.0/16` only** (no public Postgres ever). ICMP from `10.0.0.0/16`. |

## Postgres

- Version: **16.14** (matches current Linode prod for clean pg_restore)
- Extensions: `pgvector`, `pgcrypto`
- Per-service databases:
  - `auth_service`, `admin_core_service`, `assessment_service`,
  - `media_service`, `notification_service`, `community_service`
- Superuser: `postgres` (local-only via peer auth)
- App user: `vacademy` (used by services and pgbouncer)
- Replication user: `replicator` (used by db-standby only)
- Data dir: `/var/lib/postgresql/16/main` (default; CCX13 NVMe is fast enough that we don't need a custom dir)
- Listen: `0.0.0.0:5432` (firewall restricts to `10.0.0.0/16`)
- WAL archive: pgBackRest → Hetzner Storage Box

## Storage Box (backups)

- Plan: BX11 (1 TB, ~$4/mo)
- Username/host: from Hetzner UI (e.g. `u123456@u123456.your-storagebox.de`)
- Used by pgBackRest as `sftp` repo

## In-cluster (k3s)

- Helm release name: `vac` (matches stage convention)
- Namespace: `default`
- pgbouncer Deployment (from chart): listens on `:6432`, forwards to `db-primary:5432`
- `env.db.host = pgbouncer` (services connect through it)
- Ingress: NGINX (chart default for prod), listens on the k3s LB

## Domains (Cloudflare)

To be flipped from current Linode LB IP → k3s-node-1 (or a Hetzner Cloud LB)
public IP at cutover time. **Lower TTL to 60 s by Saturday.**

| Record | Current target | New target |
|---|---|---|
| `admin.vacademy.io`   | Linode LB | k3s ingress |
| `app.vacademy.io`     | Linode LB | k3s ingress |
| `backend.vacademy.io` | Linode LB | k3s ingress |

(Confirm the actual list with `dig` against current values — there may be more
subdomains: `meeting.`, `auth.`, etc.)

## Conventions used across scripts

- All scripts: `bash` with `set -euo pipefail`
- Ubuntu 24.04 (apt + systemd)
- All paths under `/root/vacademy-migration/`
- pgBackRest stanza name: `vacademy-prod`
- Retention: 7 days full, 28 days diff, 90 days WAL
- All scripts read host config from `topology.env` (sourced; auto-generated from this doc when scripts run)

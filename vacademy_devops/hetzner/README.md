# Hetzner Migration — Linode → Hetzner Singapore

Plan and artifacts for migrating prod from Linode Mumbai (LKE + managed Postgres)
to Hetzner Singapore (self-managed k3s + self-managed Postgres). Target window:
**Sunday, 1–2 h downtime acceptable.**

## Why

| | Linode (current) | Hetzner (proposed) |
|---|---|---|
| Compute | LKE managed, 6 nodes, 12 vCPU / 24 GB | k3s self-managed, **3× CCX23** = 12 vCPU AMD / **48 GB** |
| DB | Managed PG 16.14, **4 GB / 2 vCPU / 58 GB**, 1 Node (no HA) | **CCX13 primary + CCX13 standby**, 8 GB / 2 vCPU / 80 GB NVMe each, **streaming replication** |
| Region | Mumbai | Singapore (~60–80 ms RTT to India, validated for meeting traffic) |
| Backups | Linode-managed | pgBackRest → Hetzner Storage Box (we own) |
| Monthly | ~$240 | ~$246 (3×$60.49 + 2×$32.49) |

**This is a hardware + HA upgrade at parity cost, not a cost cut.** Wins:
- 2× compute RAM, dedicated AMD cores (vs Linode shared)
- 2× DB RAM, local NVMe storage, **real DB HA you don't have today**
- DB + compute co-located → faster chained app→DB calls

**Costs**: we now own k3s upgrades, Postgres operations, backups, monitoring.

## Topology

```
                 Cloudflare (DNS, edge cache, WAF)
                              │
                       Hetzner SIN private network (10.0.0.0/16)
                ┌──────────────┼──────────────────────┐
                │              │                      │
        ┌───────▼─────┐ ┌──────▼─────┐ ┌──────────────▼──────────┐
        │  k3s-node-1 │ │ k3s-node-2 │ │      k3s-node-3         │
        │   CCX23     │ │   CCX23    │ │       CCX23             │
        │  (control+  │ │ (control+  │ │     (control+           │
        │   worker)   │ │  worker)   │ │      worker)            │
        │  16GB/4vCPU │ │ 16GB/4vCPU │ │     16GB/4vCPU          │
        └──────┬──────┘ └──────┬─────┘ └────────────┬────────────┘
               │   embedded etcd HA across 3 nodes  │
               └──────────────┬─────────────────────┘
                              │
                  ┌───────────▼───────────┐
                  │   pgbouncer (in k3s)  │
                  │   :6432, all services │
                  └───────────┬───────────┘
                              │ private network
                  ┌───────────▼─────────────┐    ┌─────────────────┐
                  │   db-primary (CCX13)    │───►│ db-standby      │
                  │   8GB/2vCPU/80GB NVMe   │    │ (CCX13, async   │
                  │   PG 16.14 + pgvector   │    │  streaming repl)│
                  └───────────┬─────────────┘    └─────────────────┘
                              │
                  ┌───────────▼─────────────┐
                  │ pgBackRest →            │
                  │  Hetzner Storage Box    │
                  │  (encrypted, daily PITR)│
                  └─────────────────────────┘
```

## Workstreams (Thu–Sun)

| When | Owner | What |
|---|---|---|
| **Thu/Fri** | You | Provision: 3× CCX23 + 2× CCX13 in Singapore; private network; Storage Box; Cloudflare API token |
| Thu/Fri | Me | Write k3s + Postgres bring-up scripts, `values-prod-hetzner.yaml`, pgBackRest config |
| **Fri** | You + me | Run bring-up scripts on the new boxes; verify k3s HA + Postgres up + extensions installed |
| Fri | You | **Lower Cloudflare TTL to 60 s** on every record we'll flip — must propagate before Sunday |
| Fri | You + me | **Run `bash export-linode-prod-config.sh`** against the live Linode kubeconfig to produce `values-prod-hetzner.yaml` (CM-sourced env) + `values.secret.yaml` (decoded Secret). Confirm the `jwtSecretKey` fingerprint the script prints matches what the running Linode services use today — a mismatch silently invalidates every active session. Stash `values.secret.yaml` (gitignored, mode 0600) where the Sunday driver can reach it. |
| **Sat** | You + me | Schema-only restore Linode → Hetzner; helm install chart on Hetzner pointed at empty Hetzner DB; pods boot (errors on missing data expected); verify TLS, ingress, service discovery |
| Sat | Me | Write cutover script + maintenance page + Cloudflare DNS-flip script |
| **Sun (window)** | You + me | Execute [CUTOVER_PLAYBOOK.md](CUTOVER_PLAYBOOK.md) |
| **Sun–Tue** | You | Monitor; leave Linode running 48–72 h as rollback safety; decommission after sanity period |

## Files in this directory

| File | Purpose | Status |
|---|---|---|
| [README.md](README.md) | This file — overview + index | ✅ |
| [CUTOVER_PLAYBOOK.md](CUTOVER_PLAYBOOK.md) | Minute-by-minute Sunday plan with rollback gates | ✅ |
| [TOPOLOGY.md](TOPOLOGY.md) | Detailed sizing rationale + private-network IPs | ⏳ |
| `bring-up-k3s.sh` | k3s HA install on 3× CCX23 (embedded etcd) | ⏳ |
| `bring-up-postgres.sh` | PG install on CCX13: extensions, DBs, roles, pg_hba | ⏳ |
| `setup-streaming-replication.sh` | Standby attach via `pg_basebackup` + recovery config | ⏳ |
| `setup-pgbackrest.sh` + `pgbackrest.conf` | Encrypted backups → Hetzner Storage Box, with restore test | ⏳ |
| `dump-restore.sh` | Cutover-window data migration script | ⏳ |
| `cloudflare-dns-flip.sh` | One-shot DNS flip via Cloudflare API | ⏳ |
| `maintenance-page.html` | Static splash served during the window | ⏳ |
| `values-prod-hetzner.yaml.template` | Template with `REPLACE_*` tokens — committed; source of truth for the chart-overlay structure | ✅ |
| `export-linode-prod-config.sh` | Friday helper: dumps the live Linode ConfigMap + Secret and produces filled-in `values-prod-hetzner.yaml` and `values.secret.yaml` (both gitignored). MUST run before Saturday's dry-run. | ✅ |
| `values-prod-hetzner.yaml` | Generated by `export-linode-prod-config.sh` (gitignored). Consumed by the helm upgrade on Sunday. | 🔒 generated |
| `values.secret.yaml` | Generated by `export-linode-prod-config.sh` (gitignored, 0600). Carries `jwtSecretKey` + all API/AWS/OAuth secrets verbatim from Linode prod. | 🔒 generated |

## Open prereqs (you)

1. **Hetzner Cloud project created** in Singapore region (SIN1).
2. **Cloudflare API token** with `Zone:DNS:Edit` scope for `vacademy.io` (used for the one-shot DNS flip Sunday).
3. **Linode kubeconfig + read access to ns `default`** so `export-linode-prod-config.sh` can read the live ConfigMap + Secret on Friday and produce `values-prod-hetzner.yaml` + `values.secret.yaml`. The script base64-decodes every Secret key (including `JWT_SECRET_KEY`) and prints a 12-char fingerprint to verify against the live cluster — CLAUDE.md flags that several Java services hardcode `jwtSecretKey` as a fallback, so a mismatch silently invalidates every active session and every outstanding email/invite token.
4. **DB sizes for the other databases** — `SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database WHERE datname NOT IN ('postgres','template0','template1') ORDER BY pg_database_size(datname) DESC;` — confirms cutover dump time. (admin_core_service is 798 MB; expecting total <10 GB.)
5. **Hetzner Storage Box** (BX11, ~$4/mo for 1 TB) for backups.

## Rollback principle

DNS lives on Cloudflare. If anything is wrong on Sunday → **flip DNS back to Linode**. Linode stays running for 48–72 h post-cutover specifically for this. The only loss is whatever was written to Hetzner during the window after cutover (caught by post-cutover audit; usually <1 h of activity).

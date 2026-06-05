# BBB Load Testing

Reproduce the "210 students in 5 minutes → mass removal" incident against a
**CCX43** so we can find its real ceiling *before* trusting it in production.

## Golden rules

1. **Test an isolated clone, never `meet.vacademy.io` during class.** Spin a throwaway
   CCX43 from the latest snapshot on a test domain (e.g. `meet-test.vacademy.io`),
   test it, then destroy it. (`manage-server.sh` / the pool workflow can do this.)
2. **Generators run as dedicated pods** in the `loadtest` namespace on the k3s
   cluster — separate project/servers from BBB, so they never steal the BBB box's
   CPU and the traffic crosses the real network like actual users.
3. **The pass/fail signal is on the BBB box:** CPU must stay **< 70%** (above that,
   audio degrades) and idle students must **not** hold mic channels (transparent
   listen-only working).

## What's here

| File | Runs where | Purpose |
|------|-----------|---------|
| `join_storm.py` | anywhere w/ python3 | Create the test meeting; fire an HTTP **join storm** (auth/burst path). No browser. |
| `capture-metrics.sh` | **on the BBB box** | Log CPU/load/mem + per-process + live meeting/user/video/voice counts to CSV; flags CPU>70%. |
| `Dockerfile` + `entrypoint.sh` | build → registry | Package `openfun/bbb-stress-test` (real Puppeteer browsers w/ audio+webcam) as a pod image. |
| `k8s-loadgen-job.yaml` | k3s | Scale the browser load to N pods (the **real media test**). |
| `.env.example` | — | Config template. |

### Two layers, because they test different things
- **`join_storm.py` (HTTP):** create + session-token issuance + auth layer under a burst. Fast, no browser, runs today. **Does not** generate WebRTC media load.
- **`bbb-stress-test` pods (browsers):** real audio mixing + webcam forwarding — the load that actually melted the server. This is the one that proves capacity.

Run **both at once** for the closest reproduction, with `capture-metrics.sh` recording on the BBB box.

## Run it

**0. Provision an isolated CCX43 clone** and verify it's tuned (16 mediasoup workers, transparent listen-only) — see the main runbook.

**1. Create the meeting + sanity-check the auth path:**
```bash
export BBB_URL=https://meet-test.vacademy.io/bigbluebutton
export BBB_SECRET=<test-clone-secret>
python3 join_storm.py create                       # prints meetingID + a moderator URL to eyeball
python3 join_storm.py storm --clients 200 --ramp 300   # 200 joins over 5 min
```

**2. Start metrics on the BBB box (separate terminal, SSH'd into the clone):**
```bash
bash capture-metrics.sh 5     # logs every 5s, flags CPU>70%
```

**3. Real media load via pods:**
```bash
docker build -t ghcr.io/vacademy-io/bbb-loadgen:latest .   # push to your registry
kubectl create namespace loadtest
kubectl -n loadtest create secret generic bbb-loadtest --from-literal=BBB_SECRET="$BBB_SECRET"
# edit BBB_URL / BBB_MEETING_ID / parallelism in k8s-loadgen-job.yaml, then:
kubectl apply -f k8s-loadgen-job.yaml
kubectl -n loadtest get pods -w
```
`parallelism × (LISTEN_ONLY + MIC + WEBCAM)` = total users. The shipped default
(10 pods × 16 listen + 4 webcam) = **200 users / 40 cams** — the incident profile.
Ramp up across runs (50 → 100 → 200 → 250) and find where CPU crosses 70% or
clients start dropping. **That number is your safe single-CCX43 ceiling.**

**4. Tear down:** `kubectl delete ns loadtest` (and destroy the test clone).

## Sizing the generators
- A webcam browser peaks high on RAM (render_worker notes ~2.5 GB for a render
  browser; a load client is lighter but still hundreds of MB–GBs). Keep
  `BBB_CLIENTS_WEBCAM` per pod small (≈4) and scale **pods**, not clients-per-pod.
- Per-pod resource requests/limits are in the Job — tune to the client count.
- Cluster has headroom (confirmed), so add pods freely; just keep them on
  spare/dedicated nodes (`nodeSelector`) so live render jobs aren't disturbed.

## Reading results
Compare the CSV across runs/sizes. You're looking for the user count at which:
- `cpu_used_pct` crosses ~70% (sustained), and/or
- `join SUCCESS` in the storm drops below 100%, and/or
- `videos`/`voice` counts stop tracking the clients you launched (clients failing to fully join).

## Caveats / honesty
- `join_storm.py` is fully self-contained and correct (sha256 checksums matching
  the backend). The `Dockerfile`/`entrypoint.sh` wrap a **third-party** tool —
  verify `make bootstrap` / `make stress` / the Chrome path against the current
  [openfun/bbb-stress-test](https://github.com/openfun/bbb-stress-test) before relying on it.
- Generators and BBB may be in different regions; that adds latency (a *conservative*
  skew — if it holds under higher latency, real users are fine) but doesn't change
  the server-CPU capacity finding.
- These scripts are for an isolated clone. Nothing here should be pointed at prod.

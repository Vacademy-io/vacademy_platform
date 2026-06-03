#!/usr/bin/env python3
"""
BBB load-test helper — create a test meeting and/or fire a "join storm".

Two jobs:
  1. create  — create a meeting via the BBB API and print its meetingID plus a
               moderator join URL. Use the meetingID as BBB_MEETING_ID for the
               Puppeteer pods (bbb-stress-test); open the moderator URL in a
               browser to eyeball the room while the test runs.
  2. storm   — ensure the meeting exists, then fire N concurrent HTTP joins over
               a ramp window to reproduce the "200 users in 5 minutes" burst
               that caused the mass-removal. Reports success rate + latency.

LIMITATION (read this): an HTTP join exercises create + session-token issuance +
the bbb-web / auth layer under burst, but NOT the full WebRTC media path (audio
mixing in FreeSWITCH, webcam forwarding in the SFU) that actually dominates CPU.
For the real media load use the Puppeteer pods (see README.md). The best
reproduction is to run THIS join-storm AND the media pods together, while
capture-metrics.sh runs on the BBB box.

Checksum defaults to sha256 to match the Vacademy backend (BbbMeetingManager).
Stdlib only; Python 3.8+.
"""
import argparse
import concurrent.futures as cf
import hashlib
import os
import re
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid


def checksum(call, query, secret, algo):
    h = hashlib.new(algo)
    h.update((call + query + secret).encode("utf-8"))
    return h.hexdigest()


def build_url(base, call, params, secret, algo):
    query = urllib.parse.urlencode(params)
    cs = checksum(call, query, secret, algo)
    sep = "&" if query else ""
    return f"{base.rstrip('/')}/api/{call}?{query}{sep}checksum={cs}"


def http_get(url, timeout):
    t0 = time.monotonic()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "bbb-loadtest/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, time.monotonic() - t0, resp.read(4096).decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, time.monotonic() - t0, ""
    except Exception as e:  # noqa: BLE001 - any transport error is a failed "user"
        return 0, time.monotonic() - t0, str(e)[:160]


def is_success(status, body):
    return status == 200 and "<returncode>SUCCESS</returncode>" in body


def err_key(status, body):
    if status != 200:
        return f"http_{status}" if status else "conn_error/timeout"
    m = re.search(r"<messageKey>([^<]+)</messageKey>", body)
    return m.group(1) if m else "unknown"


def create_meeting(base, secret, algo, meeting_id, name):
    params = {
        "name": name,
        "meetingID": meeting_id,
        "record": "false",
        "muteOnStart": "true",
        "meetingCameraCap": "20",   # mirror production policy
        "userCameraCap": "3",
    }
    return http_get(build_url(base, "create", params, secret, algo), 30)


def join_url(base, secret, algo, meeting_id, full_name, role, redirect):
    params = {
        "meetingID": meeting_id,
        "fullName": full_name,
        "role": role,                       # BBB 3.0 role-based join (VIEWER|MODERATOR)
        "userID": "lt-" + uuid.uuid4().hex[:10],
        "redirect": "true" if redirect else "false",
    }
    return build_url(base, "join", params, secret, algo)


def pct(sorted_vals, p):
    if not sorted_vals:
        return 0.0
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    return statistics.quantiles(sorted_vals, n=100)[min(p, 99) - 1]


def cmd_create(a):
    status, _, body = create_meeting(a.url, a.secret, a.algo, a.meeting_id, a.name)
    if not is_success(status, body):
        print(f"CREATE FAILED ({err_key(status, body)}). Body:\n{body}", file=sys.stderr)
        return 1
    mod = join_url(a.url, a.secret, a.algo, a.meeting_id, "LoadTest-Moderator", "MODERATOR", True)
    print(f"meetingID={a.meeting_id}")
    print(f"moderator_join_url={mod}")
    print("\nSet BBB_MEETING_ID=" + a.meeting_id + " for the bbb-stress-test pods.")
    return 0


def cmd_storm(a):
    status, _, body = create_meeting(a.url, a.secret, a.algo, a.meeting_id, a.name)
    if not is_success(status, body):
        print(f"Could not ensure meeting ({err_key(status, body)}): {body}", file=sys.stderr)
        return 1
    print(f"Meeting ready: {a.meeting_id}. Firing {a.clients} joins over {a.ramp:.0f}s "
          f"(<= {a.concurrency} in flight)...", file=sys.stderr)

    interval = (a.ramp / a.clients) if a.clients else 0
    start = time.monotonic()

    def worker(i):
        target = start + i * interval
        slack = target - time.monotonic()
        if slack > 0:
            time.sleep(slack)
        url = join_url(a.url, a.secret, a.algo, a.meeting_id, f"LoadTest-{i:04d}", "VIEWER", False)
        return http_get(url, a.timeout)

    results = []
    with cf.ThreadPoolExecutor(max_workers=a.concurrency) as pool:
        for fut in cf.as_completed([pool.submit(worker, i) for i in range(a.clients)]):
            results.append(fut.result())

    wall = time.monotonic() - start
    ok_n = sum(1 for s, _, b in results if is_success(s, b))
    lats = sorted(d for _, d, _ in results)
    errs = {}
    for s, _, b in results:
        if not is_success(s, b):
            k = err_key(s, b)
            errs[k] = errs.get(k, 0) + 1

    print("\n================ JOIN-STORM RESULT ================")
    print(f"clients          : {a.clients}")
    print(f"wall clock       : {wall:.1f}s  (~{a.clients / wall:.1f} joins/s)")
    print(f"join SUCCESS     : {ok_n}  ({100 * ok_n / len(results):.1f}%)")
    print(f"latency p50/p95  : {pct(lats, 50) * 1000:.0f} / {pct(lats, 95) * 1000:.0f} ms")
    print(f"latency max      : {max(lats) * 1000:.0f} ms")
    if errs:
        print(f"failures         : {dict(sorted(errs.items()))}")
    print("===================================================")
    print("NOTE: HTTP joins test create + token issuance + the auth layer under burst, NOT")
    print("      WebRTC media. Run alongside the bbb-stress-test pods and watch CPU < 70%.")
    return 0 if ok_n == len(results) else 2


def main():
    p = argparse.ArgumentParser(description="BBB load-test: create a meeting and/or fire a join-storm.")
    p.add_argument("mode", choices=["create", "storm"])
    p.add_argument("--url", default=os.environ.get("BBB_URL"),
                   help="BBB base URL ending in /bigbluebutton (env BBB_URL), e.g. https://meet-test.vacademy.io/bigbluebutton")
    p.add_argument("--secret", default=os.environ.get("BBB_SECRET"), help="BBB shared secret (env BBB_SECRET)")
    p.add_argument("--meeting-id", default=os.environ.get("BBB_MEETING_ID", "loadtest-001"))
    p.add_argument("--name", default="Load Test")
    p.add_argument("--algo", default="sha256", choices=["sha1", "sha256", "sha512"])
    p.add_argument("--clients", type=int, default=200)
    p.add_argument("--ramp", type=float, default=300.0, help="seconds to spread joins over (default 300 = 5 min)")
    p.add_argument("--concurrency", type=int, default=50)
    p.add_argument("--timeout", type=float, default=30.0)
    a = p.parse_args()
    if not a.url or not a.secret:
        p.error("BBB url and secret required (--url/--secret or BBB_URL/BBB_SECRET env)")
    return cmd_create(a) if a.mode == "create" else cmd_storm(a)


if __name__ == "__main__":
    sys.exit(main())

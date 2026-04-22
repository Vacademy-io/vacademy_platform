#!/usr/bin/env python3
"""
BBB Health Dashboard — browser-accessible server health & quick actions.

Listens on 127.0.0.1:9092 (exposed via nginx at /internal/health).
Authenticated via ?token=<HEALTH_DASHBOARD_TOKEN> query parameter.

Endpoints:
  GET  /                              → HTML dashboard page
  GET  /api/metrics?token=xxx         → JSON system metrics + service status
  POST /api/action/delete-old-recordings?token=xxx  → Delete recordings >2 days
  POST /api/action/restart-bbb?token=xxx            → bbb-conf --restart + --setip
"""

import os
import hmac
import hashlib
import json
import time
import shutil
import subprocess
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
from urllib.request import urlopen
from urllib.error import URLError

HEALTH_TOKEN = os.environ.get('HEALTH_DASHBOARD_TOKEN', '')
BBB_DOMAIN = os.environ.get('BBB_DOMAIN', 'meet.vacademy.io')
BBB_SECRET = os.environ.get('VACADEMY_BBB_SECRET', '')
PORT = int(os.environ.get('HEALTH_DASHBOARD_PORT', '9092'))
LOG_FILE = '/var/log/bigbluebutton/vacademy-health-dashboard.log'

BBB_SERVICES = [
    'bbb-web', 'bbb-apps-akka', 'bbb-fsesl-akka', 'nginx', 'redis-server',
    'freeswitch', 'bbb-webrtc-sfu', 'bbb-graphql-server',
    'bbb-rap-resque-worker', 'bbb-heal-service', 'bbb-health-dashboard',
]


def log(msg):
    try:
        with open(LOG_FILE, 'a') as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
    except Exception:
        pass


def get_disk_info():
    usage = shutil.disk_usage('/')
    return {
        'total_gb': round(usage.total / (1024 ** 3), 1),
        'used_gb': round(usage.used / (1024 ** 3), 1),
        'free_gb': round(usage.free / (1024 ** 3), 1),
        'percent': round(usage.used / usage.total * 100, 1),
    }


def get_memory_info():
    info = {}
    try:
        with open('/proc/meminfo', 'r') as f:
            for line in f:
                parts = line.split()
                if parts[0] == 'MemTotal:':
                    info['total_mb'] = int(parts[1]) // 1024
                elif parts[0] == 'MemAvailable:':
                    info['available_mb'] = int(parts[1]) // 1024
        info['used_mb'] = info['total_mb'] - info['available_mb']
        info['percent'] = round(info['used_mb'] / info['total_mb'] * 100, 1)
    except Exception:
        info = {'total_mb': 0, 'available_mb': 0, 'used_mb': 0, 'percent': 0}
    return info


def get_cpu_info():
    try:
        with open('/proc/loadavg', 'r') as f:
            parts = f.read().split()
        load_1, load_5, load_15 = float(parts[0]), float(parts[1]), float(parts[2])
        cpu_count = os.cpu_count() or 1
        return {
            'load_1': load_1, 'load_5': load_5, 'load_15': load_15,
            'cpu_count': cpu_count,
            'percent': round(load_1 / cpu_count * 100, 1),
        }
    except Exception:
        return {'load_1': 0, 'load_5': 0, 'load_15': 0, 'cpu_count': 1, 'percent': 0}


def get_service_statuses():
    results = []
    for svc in BBB_SERVICES:
        try:
            r = subprocess.run(
                ['systemctl', 'is-active', svc],
                capture_output=True, text=True, timeout=5
            )
            status = r.stdout.strip()
        except Exception:
            status = 'unknown'
        results.append({'name': svc, 'status': status})
    return results


def get_recording_stats():
    """Count recordings on disk and their total size."""
    dirs = [
        '/var/bigbluebutton/published/presentation',
        '/var/bigbluebutton/recording/raw',
    ]
    total_count = 0
    total_bytes = 0
    for d in dirs:
        try:
            for entry in os.scandir(d):
                if entry.is_dir():
                    total_count += 1
                    for root, subdirs, files in os.walk(entry.path):
                        for f in files:
                            try:
                                total_bytes += os.path.getsize(os.path.join(root, f))
                            except OSError:
                                pass
        except FileNotFoundError:
            pass
    return {
        'count': total_count,
        'size_gb': round(total_bytes / (1024 ** 3), 2),
    }


def get_bbb_meetings():
    """Query BBB API for active meetings and participant counts."""
    if not BBB_SECRET:
        return {'meeting_count': 0, 'participant_count': 0, 'listener_count': 0,
                'voice_count': 0, 'video_count': 0, 'meetings': [], 'error': 'BBB_SECRET not set'}

    call = 'getMeetings'
    checksum = hashlib.sha1(f'{call}{BBB_SECRET}'.encode()).hexdigest()
    url = f'https://{BBB_DOMAIN}/bigbluebutton/api/{call}?checksum={checksum}'

    try:
        with urlopen(url, timeout=10) as resp:
            xml_data = resp.read()
        root = ET.fromstring(xml_data)

        if root.find('returncode').text != 'SUCCESS':
            return {'meeting_count': 0, 'participant_count': 0, 'listener_count': 0,
                    'voice_count': 0, 'video_count': 0, 'meetings': []}

        meetings = []
        total_participants = 0
        total_listeners = 0
        total_voice = 0
        total_video = 0

        for m in root.findall('.//meeting'):
            name = m.findtext('meetingName', '')
            participants = int(m.findtext('participantCount', '0'))
            listeners = int(m.findtext('listenerCount', '0'))
            voice = int(m.findtext('voiceParticipantCount', '0'))
            video = int(m.findtext('videoCount', '0'))
            running = m.findtext('running', 'false') == 'true'
            recording = m.findtext('recording', 'false') == 'true'
            start_time = m.findtext('startTime', '0')

            total_participants += participants
            total_listeners += listeners
            total_voice += voice
            total_video += video

            meetings.append({
                'name': name,
                'participants': participants,
                'listeners': listeners,
                'voice': voice,
                'video': video,
                'running': running,
                'recording': recording,
                'start_time': start_time,
            })

        return {
            'meeting_count': len(meetings),
            'participant_count': total_participants,
            'listener_count': total_listeners,
            'voice_count': total_voice,
            'video_count': total_video,
            'meetings': meetings,
        }
    except URLError as e:
        return {'meeting_count': 0, 'participant_count': 0, 'listener_count': 0,
                'voice_count': 0, 'video_count': 0, 'meetings': [], 'error': str(e)}
    except Exception as e:
        return {'meeting_count': 0, 'participant_count': 0, 'listener_count': 0,
                'voice_count': 0, 'video_count': 0, 'meetings': [], 'error': str(e)}


def run_delete_old_recordings():
    """Delete recordings older than 2 days. Returns (success, output)."""
    cmd = (
        "echo '=== Deleting published presentations older than 2 days ===' && "
        "find /var/bigbluebutton/published/presentation/ -maxdepth 1 -mindepth 1 -type d -mtime +2 -print -exec rm -rf {} + 2>&1 && "
        "echo '' && echo '=== Deleting raw recordings older than 2 days ===' && "
        "find /var/bigbluebutton/recording/raw/ -maxdepth 1 -mindepth 1 -type d -mtime +2 -print -exec rm -rf {} + 2>&1 && "
        "echo '' && echo '=== Deleting status markers older than 2 days ===' && "
        "find /var/bigbluebutton/recording/status/ -name '*.done' -mtime +2 -print -delete 2>&1 && "
        "echo '' && echo 'Done.'"
    )
    try:
        r = subprocess.run(['bash', '-c', cmd], capture_output=True, text=True, timeout=120)
        output = r.stdout + r.stderr
        return (r.returncode == 0, output.strip() or 'Completed (no output)')
    except subprocess.TimeoutExpired:
        return (False, 'ERROR: Command timed out after 120 seconds')
    except Exception as e:
        return (False, f'ERROR: {e}')


def run_restart_bbb():
    """Restart BBB and re-set IP. Returns (success, output)."""
    cmd = f"bbb-conf --setip {BBB_DOMAIN} 2>&1 && bbb-conf --restart 2>&1"
    try:
        r = subprocess.run(['bash', '-c', cmd], capture_output=True, text=True, timeout=180)
        output = r.stdout + r.stderr
        return (r.returncode == 0, output.strip() or 'Completed (no output)')
    except subprocess.TimeoutExpired:
        return (False, 'ERROR: Command timed out after 180 seconds')
    except Exception as e:
        return (False, f'ERROR: {e}')


DASHBOARD_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BBB Health Dashboard</title>
<style>
  :root {
    --bg: #0f172a; --card: #1e293b; --border: #334155;
    --text: #e2e8f0; --muted: #94a3b8; --accent: #38bdf8;
    --green: #22c55e; --red: #ef4444; --yellow: #eab308; --orange: #f97316;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 16px; min-height: 100vh; }
  h1 { font-size: 1.4rem; margin-bottom: 4px; }
  .subtitle { color: var(--muted); font-size: 0.85rem; margin-bottom: 20px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 16px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
  .card h2 { font-size: 1rem; margin-bottom: 14px; color: var(--accent); }
  .metric-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .metric-label { color: var(--muted); font-size: 0.85rem; }
  .metric-value { font-weight: 600; font-size: 0.95rem; }
  .bar-bg { width: 100%; height: 8px; background: var(--border); border-radius: 4px; margin-top: 4px; }
  .bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s; }
  .bar-ok { background: var(--green); }
  .bar-warn { background: var(--yellow); }
  .bar-danger { background: var(--red); }
  .svc-list { list-style: none; }
  .svc-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 0.9rem; }
  .svc-item:last-child { border-bottom: none; }
  .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .dot-active { background: var(--green); }
  .dot-inactive { background: var(--red); }
  .dot-unknown { background: var(--muted); }
  .svc-name { flex: 1; }
  .svc-status { color: var(--muted); font-size: 0.8rem; }
  .actions { display: flex; flex-direction: column; gap: 12px; }
  .action-btn { padding: 12px 20px; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
  .action-btn:hover { opacity: 0.85; }
  .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-delete { background: var(--orange); color: #fff; }
  .btn-restart { background: var(--red); color: #fff; }
  .action-output { background: #0d1117; border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-top: 8px; font-family: monospace; font-size: 0.8rem; white-space: pre-wrap; max-height: 300px; overflow-y: auto; display: none; color: var(--muted); }
  .action-output.visible { display: block; }
  .recording-stats { display: flex; gap: 20px; margin-bottom: 14px; }
  .stat-box { text-align: center; }
  .stat-num { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
  .stat-label { font-size: 0.75rem; color: var(--muted); }
  .refresh-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .refresh-btn { background: var(--card); border: 1px solid var(--border); color: var(--text); padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; }
  .refresh-btn:hover { background: var(--border); }
  .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--muted); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; vertical-align: middle; margin-right: 6px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .timestamp { color: var(--muted); font-size: 0.75rem; }
  @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } body { padding: 10px; } }
</style>
</head>
<body>
<h1>BBB Server Health</h1>
<p class="subtitle" id="domain">DOMAIN_PLACEHOLDER</p>

<div class="refresh-bar">
  <span class="timestamp" id="lastUpdate">Loading...</span>
  <button class="refresh-btn" onclick="loadMetrics()">Refresh</button>
</div>

<div class="grid">
  <!-- System Metrics -->
  <div class="card">
    <h2>System Metrics</h2>
    <div id="metricsContent"><span class="spinner"></span> Loading...</div>
  </div>

  <!-- BBB Services -->
  <div class="card">
    <h2>BBB Services</h2>
    <div id="servicesContent"><span class="spinner"></span> Loading...</div>
  </div>

  <!-- Live Meetings -->
  <div class="card">
    <h2>Live Meetings</h2>
    <div id="meetingsContent"><span class="spinner"></span> Loading...</div>
  </div>

  <!-- Recordings -->
  <div class="card">
    <h2>Recordings on Disk</h2>
    <div id="recordingsContent"><span class="spinner"></span> Loading...</div>
  </div>

  <!-- Quick Actions -->
  <div class="card">
    <h2>Quick Actions</h2>
    <div class="actions">
      <div>
        <button class="action-btn btn-delete" id="btnDelete" onclick="runAction('delete-old-recordings', 'btnDelete', 'outDelete')">
          Delete Recordings Older Than 2 Days
        </button>
        <div class="action-output" id="outDelete"></div>
      </div>
      <div>
        <button class="action-btn btn-restart" id="btnRestart" onclick="runAction('restart-bbb', 'btnRestart', 'outRestart')">
          Restart BBB + Set IP
        </button>
        <div class="action-output" id="outRestart"></div>
      </div>
    </div>
  </div>
</div>

<script>
const TOKEN = new URLSearchParams(window.location.search).get('token') || '';
const BASE = window.location.pathname.replace(/\/$/, '');

function apiUrl(path) {
  return BASE + path + '?token=' + encodeURIComponent(TOKEN);
}

function barClass(pct) {
  if (pct > 85) return 'bar-danger';
  if (pct > 65) return 'bar-warn';
  return 'bar-ok';
}

function metricBlock(label, value, pct) {
  return `
    <div class="metric-row">
      <span class="metric-label">${label}</span>
      <span class="metric-value">${value}</span>
    </div>
    <div class="bar-bg"><div class="bar-fill ${barClass(pct)}" style="width:${Math.min(pct,100)}%"></div></div>
    <div style="height:8px"></div>`;
}

async function loadMetrics() {
  try {
    const res = await fetch(apiUrl('/api/metrics'));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = await res.json();

    // System metrics
    const disk = d.disk, mem = d.memory, cpu = d.cpu;
    document.getElementById('metricsContent').innerHTML =
      metricBlock('Disk', `${disk.used_gb} / ${disk.total_gb} GB (${disk.free_gb} GB free)`, disk.percent) +
      metricBlock('Memory', `${mem.used_mb} / ${mem.total_mb} MB`, mem.percent) +
      metricBlock('CPU Load', `${cpu.load_1} / ${cpu.load_5} / ${cpu.load_15} (${cpu.cpu_count} cores)`, cpu.percent);

    // Services
    let html = '<ul class="svc-list">';
    for (const svc of d.services) {
      const cls = svc.status === 'active' ? 'dot-active' : svc.status === 'inactive' ? 'dot-inactive' : 'dot-unknown';
      html += `<li class="svc-item"><span class="dot ${cls}"></span><span class="svc-name">${svc.name}</span><span class="svc-status">${svc.status}</span></li>`;
    }
    html += '</ul>';
    document.getElementById('servicesContent').innerHTML = html;

    // Live Meetings
    const mtg = d.meetings;
    let mtgHtml = `
      <div class="recording-stats">
        <div class="stat-box"><div class="stat-num">${mtg.meeting_count}</div><div class="stat-label">Meetings</div></div>
        <div class="stat-box"><div class="stat-num">${mtg.participant_count}</div><div class="stat-label">Participants</div></div>
        <div class="stat-box"><div class="stat-num">${mtg.video_count}</div><div class="stat-label">Video</div></div>
        <div class="stat-box"><div class="stat-num">${mtg.voice_count}</div><div class="stat-label">Audio</div></div>
      </div>`;
    if (mtg.meetings && mtg.meetings.length > 0) {
      mtgHtml += '<ul class="svc-list" style="margin-top:10px">';
      for (const m of mtg.meetings) {
        const recDot = m.recording ? ' 🔴' : '';
        const elapsed = m.start_time > 0 ? Math.round((Date.now() - parseInt(m.start_time)) / 60000) + ' min' : '';
        mtgHtml += `<li class="svc-item"><span class="dot dot-active"></span><span class="svc-name">${m.name}${recDot}</span><span class="svc-status">${m.participants} users · ${elapsed}</span></li>`;
      }
      mtgHtml += '</ul>';
    }
    if (mtg.error) { mtgHtml += `<div style="color:var(--red);font-size:0.8rem;margin-top:8px">${mtg.error}</div>`; }
    document.getElementById('meetingsContent').innerHTML = mtgHtml;

    // Recordings
    const rec = d.recordings;
    document.getElementById('recordingsContent').innerHTML = `
      <div class="recording-stats">
        <div class="stat-box"><div class="stat-num">${rec.count}</div><div class="stat-label">Directories</div></div>
        <div class="stat-box"><div class="stat-num">${rec.size_gb}</div><div class="stat-label">GB on disk</div></div>
      </div>`;

    document.getElementById('domain').textContent = d.domain || '';
    document.getElementById('lastUpdate').textContent = 'Updated: ' + new Date().toLocaleTimeString();
  } catch (e) {
    document.getElementById('metricsContent').innerHTML = '<span style="color:var(--red)">Failed to load: ' + e.message + '</span>';
  }
}

async function runAction(action, btnId, outId) {
  const labels = {
    'delete-old-recordings': 'This will DELETE all recordings older than 2 days. Continue?',
    'restart-bbb': 'This will RESTART all BBB services and re-set the IP. This may take 1-2 minutes. Continue?',
  };
  if (!confirm(labels[action] || 'Are you sure?')) return;

  const btn = document.getElementById(btnId);
  const out = document.getElementById(outId);
  const origText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Running...';
  out.textContent = 'Executing...';
  out.classList.add('visible');

  try {
    const res = await fetch(apiUrl('/api/action/' + action), { method: 'POST' });
    const d = await res.json();
    out.textContent = (d.success ? 'SUCCESS' : 'FAILED') + '\n\n' + (d.output || '');
    if (d.success) setTimeout(loadMetrics, 1000);
  } catch (e) {
    out.textContent = 'ERROR: ' + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
}

// Initial load + auto-refresh every 30s
loadMetrics();
setInterval(loadMetrics, 30000);
</script>
</body>
</html>
"""


class DashboardHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        log(f"{self.address_string()} {fmt % args}")

    def _auth_ok(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        token = params.get('token', [None])[0]
        return HEALTH_TOKEN and token and hmac.compare_digest(token, HEALTH_TOKEN)

    def _respond(self, code, body, content_type='application/json'):
        if content_type == 'application/json':
            payload = json.dumps(body).encode()
        else:
            payload = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _path(self):
        return urlparse(self.path).path.rstrip('/')

    def do_GET(self):
        if not self._auth_ok():
            return self._respond(403, {"error": "forbidden — append ?token=<TOKEN> to the URL"})

        path = self._path()

        if path == '' or path == '/':
            html = DASHBOARD_HTML.replace('DOMAIN_PLACEHOLDER', BBB_DOMAIN)
            return self._respond(200, html, 'text/html')

        if path == '/api/metrics':
            data = {
                'domain': BBB_DOMAIN,
                'disk': get_disk_info(),
                'memory': get_memory_info(),
                'cpu': get_cpu_info(),
                'services': get_service_statuses(),
                'recordings': get_recording_stats(),
                'meetings': get_bbb_meetings(),
                'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            }
            return self._respond(200, data)

        return self._respond(404, {"error": "not found"})

    def do_POST(self):
        if not self._auth_ok():
            return self._respond(403, {"error": "forbidden"})

        path = self._path()

        if path == '/api/action/delete-old-recordings':
            log("ACTION: delete-old-recordings triggered")
            ok, output = run_delete_old_recordings()
            log(f"ACTION: delete-old-recordings result={'ok' if ok else 'fail'}")
            return self._respond(200, {"success": ok, "output": output})

        if path == '/api/action/restart-bbb':
            log(f"ACTION: restart-bbb triggered (domain={BBB_DOMAIN})")
            ok, output = run_restart_bbb()
            log(f"ACTION: restart-bbb result={'ok' if ok else 'fail'}")
            return self._respond(200, {"success": ok, "output": output})

        return self._respond(404, {"error": "not found"})


def main():
    if not HEALTH_TOKEN:
        log("ERROR: HEALTH_DASHBOARD_TOKEN not set in environment")
        raise SystemExit("HEALTH_DASHBOARD_TOKEN not set")
    log(f"Starting health dashboard on 127.0.0.1:{PORT} (domain={BBB_DOMAIN})")
    HTTPServer(('127.0.0.1', PORT), DashboardHandler).serve_forever()


if __name__ == '__main__':
    main()

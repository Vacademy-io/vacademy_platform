import json, os
S = json.load(open("/private/tmp/claude-501/-Volumes-shreyash-ex-Vacademy/e3ec54bb-c791-4a8f-a111-ac06f4b94259/scratchpad/samples.json"))
LINE_TITLES = {"opening":"Opening","pitch":"The pitch","question":"Discovery question"}
ORDER = ["opening","pitch","question"]

def cell(line, vendor, speaker):
    k = f"{line}|{vendor}|{speaker}"
    v = S[k]
    m = v.get("meter") or {}
    srv = f'<span class="srv">server {m["ttfa_ms"]:.0f}ms</span>' if m.get("ttfa_ms") else ""
    slow = " slow" if v["ttfb"] > 1.0 else ""
    vlabel = "Rumik Mulberry 1.5" if vendor=="rumik" else "Sarvam bulbul:v3"
    return f'''<div class="cell {vendor}">
  <div class="chead"><span class="vend">{vlabel}</span><span class="spk">{speaker}</span></div>
  <button class="play" data-k="{k}" aria-label="Play {vlabel}, voice {speaker}, {LINE_TITLES[line]}">
    <span class="glyph" aria-hidden="true"></span>
    <canvas class="wave" width="600" height="56"></canvas>
  </button>
  <div class="crow">
    <span class="ttfb{slow}">first audio {v["ttfb"]:.2f}s</span>{srv}
    <span class="dur">{v["secs"]:.2f}s</span>
  </div>
</div>'''

blocks = []
for line in ORDER:
    text = S[f"{line}|rumik|ira"]["text"]
    blocks.append(f'''<section class="line">
  <header class="lhead">
    <h2>{LINE_TITLES[line]}</h2>
    <p class="said">{text}</p>
  </header>
  <div class="grid">
    <div class="pair"><span class="plabel">Female voice</span>
      {cell(line,"rumik","ira")}{cell(line,"sarvam","priya")}</div>
    <div class="pair"><span class="plabel">Male voice</span>
      {cell(line,"rumik","adam")}{cell(line,"sarvam","shubh")}</div>
  </div>
</section>''')

audio = {k: v["wav8k"] for k, v in S.items()}

HTML = '''<title>Rumik vs Sarvam — listen before we switch</title>
<style>
:root{
  --ground:#E9ECEE; --panel:#F4F6F7; --edge:#CBD2D6;
  --ink:#101418; --ink-2:#48535E; --ink-3:#75818B;
  --new:#0B6E4F; --new-soft:#0B6E4F1a;
  --old:#46536B; --old-soft:#46536B14;
  --flag:#B0342B;
  --mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
}
@media (prefers-color-scheme:dark){:root{
  --ground:#0E1216; --panel:#161C22; --edge:#2A343C;
  --ink:#E7ECEF; --ink-2:#A3AFB8; --ink-3:#76838D;
  --new:#3FBF8F; --new-soft:#3FBF8F1f; --old:#8C9AB4; --old-soft:#8C9AB417; --flag:#E4695C;
}}
:root[data-theme=dark]{
  --ground:#0E1216; --panel:#161C22; --edge:#2A343C;
  --ink:#E7ECEF; --ink-2:#A3AFB8; --ink-3:#76838D;
  --new:#3FBF8F; --new-soft:#3FBF8F1f; --old:#8C9AB4; --old-soft:#8C9AB417; --flag:#E4695C;
}
:root[data-theme=light]{
  --ground:#E9ECEE; --panel:#F4F6F7; --edge:#CBD2D6;
  --ink:#101418; --ink-2:#48535E; --ink-3:#75818B;
  --new:#0B6E4F; --new-soft:#0B6E4F1a; --old:#46536B; --old-soft:#46536B14; --flag:#B0342B;
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--sans);
  line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:1120px;margin:0 auto;padding:clamp(20px,4vw,56px) clamp(16px,3vw,32px) 80px}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;
  color:var(--ink-3);margin:0 0 14px}
h1{font-family:var(--mono);font-weight:600;font-size:clamp(24px,3.4vw,38px);line-height:1.15;
  letter-spacing:-.02em;margin:0 0 12px;text-wrap:balance}
.lede{max-width:62ch;color:var(--ink-2);font-size:16px;margin:0 0 6px}
.lede b{color:var(--ink);font-weight:600}

.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:1px;
  background:var(--edge);border:1px solid var(--edge);border-radius:3px;margin:32px 0 8px;overflow:hidden}
.stat{background:var(--panel);padding:14px 16px}
.stat dt{font-family:var(--mono);font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;
  color:var(--ink-3);margin:0 0 7px}
.stat dd{margin:0;font-family:var(--mono);font-size:19px;font-weight:600;
  font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.stat .from{color:var(--ink-3);font-weight:400;font-size:13px}
.stat .to{color:var(--new)}
.note{font-family:var(--mono);font-size:11.5px;color:var(--ink-3);margin:10px 0 0}

.line{margin-top:44px;border-top:1px solid var(--edge);padding-top:22px}
.lhead h2{font-family:var(--mono);font-size:12px;letter-spacing:.13em;text-transform:uppercase;
  color:var(--ink-3);font-weight:500;margin:0 0 8px}
.said{margin:0 0 18px;font-size:17px;max-width:66ch;color:var(--ink)}
.grid{display:grid;gap:22px}
.pair{display:grid;gap:8px}
.plabel{font-family:var(--mono);font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-3)}
@media(min-width:860px){.pair{grid-template-columns:1fr 1fr;align-items:start}
  .plabel{grid-column:1/-1}}

.cell{background:var(--panel);border:1px solid var(--edge);border-radius:3px;padding:11px 13px 9px;
  border-left:3px solid var(--old)}
.cell.rumik{border-left-color:var(--new)}
.chead{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:7px}
.vend{font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:-.01em}
.cell.rumik .vend{color:var(--new)} .cell.sarvam .vend{color:var(--old)}
.spk{font-family:var(--mono);font-size:11px;color:var(--ink-3)}
.play{display:block;width:100%;position:relative;background:var(--old-soft);border:0;
  border-radius:2px;padding:0;cursor:pointer;overflow:hidden;height:56px}
.cell.rumik .play{background:var(--new-soft)}
.play:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.wave{display:block;width:100%;height:56px}
.glyph{position:absolute;left:9px;top:50%;transform:translateY(-50%);width:0;height:0;
  border-left:11px solid currentColor;border-top:7px solid transparent;border-bottom:7px solid transparent;
  opacity:.5;transition:opacity .15s}
.cell.rumik .glyph{color:var(--new)} .cell.sarvam .glyph{color:var(--old)}
.play:hover .glyph{opacity:.85}
.play.playing .glyph{border-left:none;width:9px;height:13px;
  border-left:4px solid currentColor;border-right:4px solid currentColor;opacity:.9}
.crow{display:flex;gap:12px;align-items:baseline;margin-top:7px;font-family:var(--mono);
  font-size:11px;color:var(--ink-3);font-variant-numeric:tabular-nums}
.ttfb{color:var(--ink-2)} .ttfb.slow{color:var(--flag);font-weight:600}
.dur{margin-left:auto}

.ev{margin-top:48px;border-top:1px solid var(--edge);padding-top:22px}
.ev h2,.caveat h2{font-family:var(--mono);font-size:12px;letter-spacing:.13em;text-transform:uppercase;
  color:var(--ink-3);font-weight:500;margin:0 0 14px}
.tw{overflow-x:auto;border:1px solid var(--edge);border-radius:3px;background:var(--panel)}
table{border-collapse:collapse;width:100%;font-size:13.5px;min-width:600px}
th{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--ink-3);text-align:left;font-weight:500;padding:10px 14px;border-bottom:1px solid var(--edge)}
td{padding:11px 14px;border-bottom:1px solid var(--edge);vertical-align:top}
tr:last-child td{border-bottom:0}
td.w{font-family:var(--mono);font-size:12px;color:var(--ink-2);white-space:nowrap}
.ok{color:var(--new);font-weight:600} .bad{color:var(--flag)}
.caveat{margin-top:44px;border-top:1px solid var(--edge);padding-top:22px}
.caveat ul{margin:0;padding-left:19px;max-width:70ch}
.caveat li{margin-bottom:11px;color:var(--ink-2);font-size:14.5px}
.caveat b{color:var(--ink)}
code{font-family:var(--mono);font-size:.9em;background:var(--old-soft);padding:1px 4px;border-radius:2px}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<div class="wrap">
<p class="eyebrow">Voice bot · TTS vendor decision · 4 Aug 2026</p>
<h1>Listen to Rumik before we make it the default</h1>
<p class="lede">Twelve samples below, same three lines, both vendors, female and male.
Every clip is <b>squeezed to the 8&nbsp;kHz the Plivo leg actually carries</b> — a 24&nbsp;kHz
comparison would flatter Rumik with fidelity the phone throws away.</p>
<p class="lede">The economics are settled. The question this page exists to answer is
whether it <b>sounds right to you</b>.</p>

<dl class="stats">
  <div class="stat"><dt>TTS cost / 1k chars</dt><dd><span class="from">₹3.00</span> → <span class="to">₹0.50</span></dd></div>
  <div class="stat"><dt>All-in cost / minute</dt><dd><span class="from">₹4.53</span> → <span class="to">₹2.26</span></dd></div>
  <div class="stat"><dt>Margin at 6 credits/min</dt><dd><span class="from">24.5%</span> → <span class="to">59.5%</span></dd></div>
  <div class="stat"><dt>Barge-in</dt><dd class="to" style="font-size:15px">cancel, socket lives</dd></div>
</dl>
<p class="note">Measured at 911 chars/min, FX ₹95.30/USD. Sarvam has no cancel primitive — barge-in
there means closing the socket, the root of 13 stalls in 220 calls.</p>

__BLOCKS__

<section class="ev">
  <h2>Pronunciation, checked without ears</h2>
  <p class="lede" style="margin-bottom:16px">Rumik's docs say “hindi in devanagari, english in latin”,
  while our prompt tells the LLM to write <em>romanized</em> Hindi for Sarvam. So I synthesized both
  spellings and read the audio back through Sarvam STT. Garbled pronunciation would surface as a
  garbled transcript.</p>
  <div class="tw"><table>
    <thead><tr><th>Input</th><th>Read back from the audio</th><th>Brand name</th></tr></thead>
    <tbody>
      <tr><td class="w">Rumik · romanized</td><td>नमस्ते, मैं रिया बोल रही हूँ … आपका स्कूल कैसे चल रहा है? <span class="ok">correct</span></td><td class="w">वर्क अड्डेमी</td></tr>
      <tr><td class="w">Rumik · devanagari</td><td>नमस्ते, मैं रिया बोल रही हूँ … आपका स्कूल कैसे चल रहा है? <span class="ok">correct</span></td><td class="w">वुक रानी</td></tr>
      <tr><td class="w">Sarvam · romanized</td><td>नमस्ते मैं रिया बोल रही हूँ … आपका स्कूल कैसे चल रहा है <span class="ok">correct</span></td><td class="w">वकारमी</td></tr>
    </tbody>
  </table></div>
  <p class="note">Romanized Hindi is safe on Mulberry — <b>no prompt change needed</b>, and it handles the
  brand name better than Devanagari does. Separately: <span class="bad">all three vendors mangle
  “Vacademy”</span>, which is a defect on every call we make today, not a Rumik regression.</p>
</section>

<section class="caveat">
  <h2>What I have not verified</h2>
  <ul>
    <li><b>Rumik's own meter reads zero.</b> The terminal frame returns <code>credits_used: 0</code> on
    this key, so the per-call cost we record is our arithmetic, not the vendor's. Worth asking them
    before we bill anyone on it.</li>
    <li><b>The Sarvam first-audio times above are the batch endpoint</b>, not the streaming socket
    production uses (0.20s median, 4.5s p95). Not apples-to-apples — I'm not claiming Sarvam is a
    35-second service. Rumik's streaming figure held near 110ms server-side on all twelve.</li>
    <li><b>Concurrency.</b> Rumik allows 20 simultaneous requests shared across the whole account.
    This box caps at 10 calls, so it fits — a second box would not.</li>
    <li><b>Nobody has heard this on a real phone call yet.</b> Every unheard vendor change this week
    produced a live incident, so the default stays Sarvam until you've listened.</li>
  </ul>
</section>
</div>

<script>
const A = __AUDIO__;
const ctxc = () => (window.__ac ||= new (window.AudioContext||window.webkitAudioContext)());
let current = null;

function b64buf(b64){
  const bin = atob(b64), n = bin.length, u = new Uint8Array(n);
  for (let i=0;i<n;i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}
function peaks(chan, cols){
  const step = Math.max(1, Math.floor(chan.length/cols)), out = [];
  for (let c=0;c<cols;c++){
    let lo=0, hi=0;
    for (let i=c*step;i<Math.min((c+1)*step, chan.length);i++){
      const v = chan[i]; if (v<lo) lo=v; if (v>hi) hi=v;
    }
    out.push([lo,hi]);
  }
  return out;
}
function draw(cv, pk, colour, prog){
  const dpr = window.devicePixelRatio||1, w = cv.clientWidth, h = cv.height;
  if (cv.width !== Math.round(w*dpr)){ cv.width = Math.round(w*dpr); cv.style.height = h+'px'; }
  const g = cv.getContext('2d');
  g.setTransform(dpr,0,0,dpr,0,0);
  g.clearRect(0,0,w,h);
  const mid = h/2, n = pk.length, bw = w/n;
  for (let i=0;i<n;i++){
    const [lo,hi] = pk[i];
    const y1 = mid - hi*mid*0.92, y2 = mid - lo*mid*0.92;
    g.fillStyle = colour;
    g.globalAlpha = (i/n) <= prog ? 1 : 0.32;
    g.fillRect(28 + i*(bw*0.955) , y1, Math.max(1, bw*0.55), Math.max(1.2, y2-y1));
  }
  g.globalAlpha = 1;
}
const cache = {};
async function decode(k){
  if (!cache[k]) cache[k] = await ctxc().decodeAudioData(b64buf(A[k]));
  return cache[k];
}
function colourFor(btn){
  return getComputedStyle(btn.closest('.cell')).borderLeftColor;
}
document.querySelectorAll('.play').forEach(async btn => {
  const k = btn.dataset.k, cv = btn.querySelector('canvas');
  let buf, pk;
  const render = (prog) => draw(cv, pk, colourFor(btn), prog);
  try {
    buf = await decode(k);
    pk = peaks(buf.getChannelData(0), 150);
    render(0);
    addEventListener('resize', () => render(0));
    matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => render(0));
  } catch(e){ return; }

  btn.addEventListener('click', async () => {
    if (current && current.btn === btn){ stop(); return; }
    if (current) stop();
    const ac = ctxc(); await ac.resume();
    const src = ac.createBufferSource();
    src.buffer = buf; src.connect(ac.destination);
    const t0 = ac.currentTime;
    src.start();
    btn.classList.add('playing');
    let raf;
    const tick = () => {
      const p = (ac.currentTime - t0) / buf.duration;
      render(Math.min(1, p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    tick();
    current = { btn, src, stopIt(){ try{src.stop()}catch(e){}; cancelAnimationFrame(raf);
      btn.classList.remove('playing'); render(0); } };
    src.onended = () => { if (current && current.btn === btn) stop(); };
  });
});
function stop(){ if (!current) return; const c = current; current = null; c.stopIt(); }
</script>'''

HTML = HTML.replace("__BLOCKS__", "\n".join(blocks)).replace("__AUDIO__", json.dumps(audio))
p = "/private/tmp/claude-501/-Volumes-shreyash-ex-Vacademy/e3ec54bb-c791-4a8f-a111-ac06f4b94259/scratchpad/tts-listen.html"
open(p, "w").write(HTML)
print("wrote", p, os.path.getsize(p)//1024, "KB")

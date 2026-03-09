import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Copy,
    Check,
    Zap,
    Clock,
    BookOpen,
    Code2,
    Radio,
    RefreshCw,
    FileText,
    History,
    ChevronDown,
    ChevronUp,
    Info,
    AlertCircle,
    CheckCircle2,
} from 'lucide-react';
import { AI_SERVICE_BASE_URL } from '@/constants/urls';

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text, className = '' }: { text: string; className?: string }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 ${className}`}
            onClick={copy}
            title="Copy"
        >
            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
        </Button>
    );
}

// ─── Code block with language switcher ────────────────────────────────────────
interface LangExample {
    lang: string;
    label: string;
    code: string;
}

function CodeBlock({ examples }: { examples: LangExample[] }) {
    const [active, setActive] = useState(examples[0]?.lang ?? '');
    const current = examples.find((e) => e.lang === active) ?? examples[0];
    return (
        <div className="rounded-lg overflow-hidden border border-slate-700">
            {/* lang tabs */}
            {examples.length > 1 && (
                <div className="flex bg-slate-800 border-b border-slate-700 px-1 pt-1 gap-0.5">
                    {examples.map((e) => (
                        <button
                            key={e.lang}
                            onClick={() => setActive(e.lang)}
                            className={`px-3 py-1 text-xs rounded-t font-mono transition-colors ${
                                active === e.lang
                                    ? 'bg-slate-900 text-slate-100'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {e.label}
                        </button>
                    ))}
                </div>
            )}
            <div className="relative group bg-slate-900">
                <pre className="text-slate-100 p-4 overflow-x-auto text-xs leading-relaxed">
                    <code>{current?.code}</code>
                </pre>
                <CopyButton
                    text={current?.code ?? ''}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-slate-800 hover:bg-slate-700 text-slate-100"
                />
            </div>
        </div>
    );
}

// ─── Inline code ──────────────────────────────────────────────────────────────
function IC({ children }: { children: React.ReactNode }) {
    return (
        <code className="bg-muted text-foreground font-mono text-[11px] px-1.5 py-0.5 rounded border border-border">
            {children}
        </code>
    );
}

// ─── Parameter table ──────────────────────────────────────────────────────────
interface Param {
    name: string;
    type: string;
    required: boolean;
    default?: string;
    description: string;
}

function ParamTable({ params }: { params: Param[] }) {
    return (
        <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
                <thead>
                    <tr className="bg-muted/50 border-b border-border">
                        <th className="text-left px-3 py-2 font-semibold text-foreground">Field</th>
                        <th className="text-left px-3 py-2 font-semibold text-foreground">Type</th>
                        <th className="text-left px-3 py-2 font-semibold text-foreground">
                            Required
                        </th>
                        <th className="text-left px-3 py-2 font-semibold text-foreground">
                            Default
                        </th>
                        <th className="text-left px-3 py-2 font-semibold text-foreground w-1/2">
                            Description
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {params.map((p, i) => (
                        <tr
                            key={p.name}
                            className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}
                        >
                            <td className="px-3 py-2 font-mono text-violet-700 dark:text-violet-400">
                                {p.name}
                            </td>
                            <td className="px-3 py-2 font-mono text-blue-700 dark:text-blue-400">
                                {p.type}
                            </td>
                            <td className="px-3 py-2">
                                {p.required ? (
                                    <span className="text-red-600 font-medium">Yes</span>
                                ) : (
                                    <span className="text-muted-foreground">No</span>
                                )}
                            </td>
                            <td className="px-3 py-2 font-mono text-muted-foreground">
                                {p.default ?? '—'}
                            </td>
                            <td className="px-3 py-2 text-foreground leading-relaxed">
                                {p.description}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Collapsible section ──────────────────────────────────────────────────────
function Section({
    title,
    children,
    defaultOpen = true,
}: {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-border rounded-lg overflow-hidden">
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
                <span className="text-sm font-semibold">{title}</span>
                {open ? (
                    <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                )}
            </button>
            {open && <div className="p-4 space-y-4">{children}</div>}
        </div>
    );
}

// ─── Method badge ─────────────────────────────────────────────────────────────
function MethodBadge({ method }: { method: 'GET' | 'POST' | 'DELETE' }) {
    const c = {
        GET: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        POST: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    }[method];
    return <Badge className={`${c} font-mono font-semibold text-xs`}>{method}</Badge>;
}

// ─── SSE event badge ──────────────────────────────────────────────────────────
function EventBadge({ type }: { type: 'progress' | 'completed' | 'info' | 'error' }) {
    const c = {
        progress: 'bg-blue-100 text-blue-800',
        completed: 'bg-green-100 text-green-800',
        info: 'bg-yellow-100 text-yellow-800',
        error: 'bg-red-100 text-red-800',
    }[type];
    const Icon = {
        progress: RefreshCw,
        completed: CheckCircle2,
        info: Info,
        error: AlertCircle,
    }[type];
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold ${c}`}>
            <Icon className="size-3" />
            {type}
        </span>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ApiDocumentation() {
    const baseUrl = AI_SERVICE_BASE_URL;

    // ── shared request params ──────────────────────────────────────────────────
    const generateParams: Param[] = [
        {
            name: 'prompt',
            type: 'string',
            required: true,
            description: 'Natural language description of the content to generate.',
        },
        {
            name: 'content_type',
            type: 'string',
            required: false,
            default: 'VIDEO',
            description:
                'Type of content. One of: VIDEO, SLIDES, QUIZ, STORYBOOK, FLASHCARDS, INTERACTIVE_GAME, PUZZLE_BOOK, SIMULATION, MAP_EXPLORATION, WORKSHEET, CODE_PLAYGROUND, TIMELINE, CONVERSATION.',
        },
        {
            name: 'language',
            type: 'string',
            required: false,
            default: 'English (US)',
            description:
                'Language for narration & content. E.g. "English (India)", "Hindi", "Spanish".',
        },
        {
            name: 'voice_gender',
            type: 'string',
            required: false,
            default: 'female',
            description: '"female" or "male".',
        },
        {
            name: 'tts_provider',
            type: 'string',
            required: false,
            default: 'edge',
            description: '"edge" (free) or "google" (premium Google Cloud TTS).',
        },
        {
            name: 'captions_enabled',
            type: 'boolean',
            required: false,
            default: 'true',
            description: 'Whether to embed word-level caption data in the output.',
        },
        {
            name: 'html_quality',
            type: 'string',
            required: false,
            default: 'advanced',
            description: '"classic" (faster, simpler layouts) or "advanced" (richer, more complex).',
        },
        {
            name: 'target_audience',
            type: 'string',
            required: false,
            default: 'General/Adult',
            description:
                'Age/level description used to calibrate complexity. E.g. "Class 5 (Ages 10-11)", "Undergraduate".',
        },
        {
            name: 'target_duration',
            type: 'string',
            required: false,
            default: '2-3 minutes',
            description:
                'Approximate output length. Options: "30 seconds", "1 minute", "2-3 minutes", "5 minutes", "10 minutes".',
        },
        {
            name: 'model',
            type: 'string',
            required: false,
            default: 'vsmart-v1',
            description: 'LLM model ID to use. Leave blank for the recommended default.',
        },
        {
            name: 'video_id',
            type: 'string',
            required: false,
            description:
                'Custom stable identifier for this generation. Auto-generated if omitted. Use the same ID to resume.',
        },
    ];

    // ── code examples ──────────────────────────────────────────────────────────
    const sseExamples: LangExample[] = [
        {
            lang: 'js',
            label: 'JavaScript',
            code: `// SSE streaming — real-time progress updates
const response = await fetch(
  '${baseUrl}/external/video/v1/generate',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Institute-Key': 'vac_live_YOUR_KEY',
    },
    body: JSON.stringify({
      prompt: 'Explain photosynthesis to a 10-year-old.',
      content_type: 'VIDEO',
      language: 'English (India)',
      voice_gender: 'female',
      tts_provider: 'edge',
      captions_enabled: true,
      html_quality: 'advanced',
      target_audience: 'Class 5 (Ages 10-11)',
      target_duration: '2-3 minutes',
    }),
  }
);

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\\n');
  buffer = lines.pop();

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const event = JSON.parse(line.slice(6));

    if (event.type === 'progress') {
      console.log(\`[\${event.stage}] \${event.percentage}% – \${event.message}\`);
      if (event.files?.timeline?.s3_url) {
        console.log('Timeline ready:', event.files.timeline.s3_url);
      }
    } else if (event.type === 'completed') {
      console.log('Done!', event.files);
    } else if (event.type === 'error') {
      console.error('Failed:', event.message);
    }
  }
}`,
        },
        {
            lang: 'python',
            label: 'Python',
            code: `import requests
import json

# SSE streaming — real-time progress updates
with requests.post(
    '${baseUrl}/external/video/v1/generate',
    headers={
        'Content-Type': 'application/json',
        'X-Institute-Key': 'vac_live_YOUR_KEY',
    },
    json={
        'prompt': 'Explain photosynthesis to a 10-year-old.',
        'content_type': 'VIDEO',
        'language': 'English (India)',
        'voice_gender': 'female',
        'tts_provider': 'edge',
        'captions_enabled': True,
        'html_quality': 'advanced',
        'target_audience': 'Class 5 (Ages 10-11)',
        'target_duration': '2-3 minutes',
    },
    stream=True,
) as resp:
    resp.raise_for_status()
    buffer = ''
    for chunk in resp.iter_content(chunk_size=None, decode_unicode=True):
        buffer += chunk
        while '\\n' in buffer:
            line, buffer = buffer.split('\\n', 1)
            if not line.startswith('data: '):
                continue
            event = json.loads(line[6:])

            if event['type'] == 'progress':
                print(f"[{event['stage']}] {event['percentage']}% – {event['message']}")
            elif event['type'] == 'completed':
                print('Done!', event.get('files'))
                break
            elif event['type'] == 'error':
                print('Error:', event['message'])
                break`,
        },
        {
            lang: 'curl',
            label: 'cURL',
            code: `curl -N -X POST \\
  '${baseUrl}/external/video/v1/generate' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Institute-Key: vac_live_YOUR_KEY' \\
  -d '{
    "prompt": "Explain photosynthesis to a 10-year-old.",
    "content_type": "VIDEO",
    "language": "English (India)",
    "voice_gender": "female",
    "tts_provider": "edge",
    "captions_enabled": true,
    "html_quality": "advanced",
    "target_audience": "Class 5 (Ages 10-11)",
    "target_duration": "2-3 minutes"
  }'

# -N flag disables buffering so SSE events print immediately`,
        },
    ];

    const pollingExamples: LangExample[] = [
        {
            lang: 'js',
            label: 'JavaScript',
            code: `// REST polling — fire-and-forget, then poll until complete
const VIDEO_ID = \`vid_\${Date.now()}_\${Math.random().toString(36).slice(2,9)}\`;

// 1. Start generation (connection can close immediately)
await fetch('${baseUrl}/external/video/v1/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Institute-Key': 'vac_live_YOUR_KEY',
  },
  body: JSON.stringify({
    prompt: 'Explain photosynthesis to a 10-year-old.',
    content_type: 'VIDEO',
    language: 'English (India)',
    video_id: VIDEO_ID,      // use a stable ID
  }),
});
// You can close the response immediately — generation runs on the server.

// 2. Poll status every 10 s until done
async function pollUntilDone(videoId, apiKey) {
  while (true) {
    const res = await fetch(
      \`${baseUrl}/external/video/v1/urls/\${videoId}\`,
      { headers: { 'X-Institute-Key': apiKey } }
    );
    const data = await res.json();

    if (data.html_url && data.audio_url) {
      console.log('Ready!');
      console.log('Timeline:', data.html_url);
      console.log('Audio:   ', data.audio_url);
      console.log('Captions:', data.words_url);
      return data;
    }
    if (data.status === 'FAILED') {
      throw new Error('Generation failed');
    }
    console.log('Still generating… retrying in 10s');
    await new Promise(r => setTimeout(r, 10_000));
  }
}

const result = await pollUntilDone(VIDEO_ID, 'vac_live_YOUR_KEY');`,
        },
        {
            lang: 'python',
            label: 'Python',
            code: `import time
import requests

VIDEO_ID = f"vid_{int(time.time())}_abc123"
API_KEY  = "vac_live_YOUR_KEY"
BASE_URL = "${baseUrl}/external/video/v1"

# 1. Start generation (don't need to read the SSE stream)
requests.post(
    f"{BASE_URL}/generate",
    headers={'Content-Type': 'application/json', 'X-Institute-Key': API_KEY},
    json={
        'prompt': 'Explain photosynthesis to a 10-year-old.',
        'content_type': 'VIDEO',
        'language': 'English (India)',
        'video_id': VIDEO_ID,
    },
    # stream=True and immediately close — generation keeps running on server
    stream=True,
    timeout=5,
)

# 2. Poll /urls/{video_id} every 10 s
while True:
    r = requests.get(
        f"{BASE_URL}/urls/{VIDEO_ID}",
        headers={'X-Institute-Key': API_KEY},
    )
    data = r.json()

    if data.get('html_url') and data.get('audio_url'):
        print('Ready!')
        print('Timeline:', data['html_url'])
        print('Audio:   ', data['audio_url'])
        print('Captions:', data.get('words_url'))
        break
    if data.get('status') == 'FAILED':
        raise RuntimeError('Generation failed')

    print('Still generating…')
    time.sleep(10)`,
        },
        {
            lang: 'curl',
            label: 'cURL',
            code: `# Step 1 — start generation (close connection after 2 s, server keeps running)
curl -m 2 -X POST \\
  '${baseUrl}/external/video/v1/generate' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Institute-Key: vac_live_YOUR_KEY' \\
  -d '{
    "prompt": "Explain photosynthesis to a 10-year-old.",
    "content_type": "VIDEO",
    "language": "English (India)",
    "video_id": "my-stable-video-id-001"
  }' || true

# Step 2 — poll status (run every ~10 s until html_url is present)
curl -s '${baseUrl}/external/video/v1/urls/my-stable-video-id-001' \\
  -H 'X-Institute-Key: vac_live_YOUR_KEY' | jq .`,
        },
    ];

    const historyExamples: LangExample[] = [
        {
            lang: 'js',
            label: 'JavaScript',
            code: `const res = await fetch(
  '${baseUrl}/external/video/v1/history?limit=20',
  { headers: { 'X-Institute-Key': 'vac_live_YOUR_KEY' } }
);
const history = await res.json();
history.forEach(item => {
  console.log(item.video_id, item.status, item.current_stage);
});`,
        },
        {
            lang: 'python',
            label: 'Python',
            code: `import requests

resp = requests.get(
    '${baseUrl}/external/video/v1/history?limit=20',
    headers={'X-Institute-Key': 'vac_live_YOUR_KEY'},
)
for item in resp.json():
    print(item['video_id'], item['status'], item['current_stage'])`,
        },
        {
            lang: 'curl',
            label: 'cURL',
            code: `curl '${baseUrl}/external/video/v1/history?limit=20' \\
  -H 'X-Institute-Key: vac_live_YOUR_KEY' | jq .`,
        },
    ];

    const statusExamples: LangExample[] = [
        {
            lang: 'js',
            label: 'JavaScript',
            code: `const res = await fetch(
  '${baseUrl}/external/video/v1/status/YOUR_VIDEO_ID',
  { headers: { 'X-Institute-Key': 'vac_live_YOUR_KEY' } }
);
const status = await res.json();
console.log(status.status, status.current_stage);
console.log(status.s3_urls);`,
        },
        {
            lang: 'python',
            label: 'Python',
            code: `import requests

resp = requests.get(
    '${baseUrl}/external/video/v1/status/YOUR_VIDEO_ID',
    headers={'X-Institute-Key': 'vac_live_YOUR_KEY'},
)
data = resp.json()
print(data['status'], data['current_stage'])`,
        },
        {
            lang: 'curl',
            label: 'cURL',
            code: `curl '${baseUrl}/external/video/v1/status/YOUR_VIDEO_ID' \\
  -H 'X-Institute-Key: vac_live_YOUR_KEY' | jq .`,
        },
    ];

    const urlsExamples: LangExample[] = [
        {
            lang: 'js',
            label: 'JavaScript',
            code: `const res = await fetch(
  '${baseUrl}/external/video/v1/urls/YOUR_VIDEO_ID',
  { headers: { 'X-Institute-Key': 'vac_live_YOUR_KEY' } }
);
const { html_url, audio_url, words_url } = await res.json();
// Pass these directly to the AIContentPlayer component`,
        },
        {
            lang: 'python',
            label: 'Python',
            code: `import requests

resp = requests.get(
    '${baseUrl}/external/video/v1/urls/YOUR_VIDEO_ID',
    headers={'X-Institute-Key': 'vac_live_YOUR_KEY'},
)
urls = resp.json()
print('Timeline:', urls.get('html_url'))
print('Audio:   ', urls.get('audio_url'))
print('Captions:', urls.get('words_url'))`,
        },
        {
            lang: 'curl',
            label: 'cURL',
            code: `curl '${baseUrl}/external/video/v1/urls/YOUR_VIDEO_ID' \\
  -H 'X-Institute-Key: vac_live_YOUR_KEY' | jq .`,
        },
    ];

    const frameRegenExamples: LangExample[] = [
        {
            lang: 'js',
            label: 'JavaScript',
            code: `const res = await fetch(
  '${baseUrl}/external/video/v1/frame/regenerate',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Institute-Key': 'vac_live_YOUR_KEY',
    },
    body: JSON.stringify({
      video_id: 'YOUR_VIDEO_ID',
      timestamp: 12.5,   // seconds into the video
      user_prompt: 'Change background to dark blue, make heading yellow.',
    }),
  }
);
const { frame_index, new_html } = await res.json();
// Preview new_html in your UI before committing`,
        },
        {
            lang: 'curl',
            label: 'cURL',
            code: `curl -X POST '${baseUrl}/external/video/v1/frame/regenerate' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Institute-Key: vac_live_YOUR_KEY' \\
  -d '{
    "video_id": "YOUR_VIDEO_ID",
    "timestamp": 12.5,
    "user_prompt": "Change background to dark blue."
  }' | jq .`,
        },
    ];

    const frameUpdateExamples: LangExample[] = [
        {
            lang: 'js',
            label: 'JavaScript',
            code: `// After previewing the new HTML from /frame/regenerate, commit it:
await fetch('${baseUrl}/external/video/v1/frame/update', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Institute-Key': 'vac_live_YOUR_KEY',
  },
  body: JSON.stringify({
    video_id: 'YOUR_VIDEO_ID',
    frame_index: 5,           // from the regenerate response
    new_html: '<html>...</html>',
  }),
});`,
        },
        {
            lang: 'curl',
            label: 'cURL',
            code: `curl -X POST '${baseUrl}/external/video/v1/frame/update' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Institute-Key: vac_live_YOUR_KEY' \\
  -d '{
    "video_id": "YOUR_VIDEO_ID",
    "frame_index": 5,
    "new_html": "<html>...</html>"
  }' | jq .`,
        },
    ];

    return (
        <div className="space-y-6 pb-8">
            {/* ── Overview ─────────────────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BookOpen className="size-5 text-violet-600" />
                        Vacademy Content Generation API
                    </CardTitle>
                    <CardDescription>
                        Generate AI-powered educational content — videos, quizzes, flashcards, games
                        and more — via a single REST endpoint.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                            {
                                icon: <Zap className="size-4 text-violet-600" />,
                                title: 'SSE Streaming',
                                desc: 'Get live progress as each stage completes.',
                            },
                            {
                                icon: <Clock className="size-4 text-blue-600" />,
                                title: 'Background Jobs',
                                desc: 'Generation continues even if you close the connection.',
                            },
                            {
                                icon: <RefreshCw className="size-4 text-green-600" />,
                                title: 'REST Polling',
                                desc: 'Simple alternative — start then poll /urls/{id}.',
                            },
                        ].map((f) => (
                            <div
                                key={f.title}
                                className="flex gap-3 p-3 rounded-lg border border-border bg-muted/20"
                            >
                                <div className="mt-0.5 shrink-0">{f.icon}</div>
                                <div>
                                    <p className="text-sm font-semibold">{f.title}</p>
                                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium">Base URL</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 bg-slate-900 text-slate-100 text-xs font-mono px-3 py-2 rounded-md border border-slate-700 overflow-x-auto">
                                {baseUrl}/external/video/v1
                            </code>
                            <CopyButton
                                text={`${baseUrl}/external/video/v1`}
                                className="shrink-0 border border-border hover:bg-muted"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium">Authentication header</p>
                        <CodeBlock
                            examples={[
                                {
                                    lang: 'http',
                                    label: 'Header',
                                    code: `X-Institute-Key: vac_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
                                },
                            ]}
                        />
                        <p className="text-xs text-muted-foreground">
                            Every request must include this header. Generate keys from the API Keys
                            tab above.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* ── Content Types ─────────────────────────────────────────────── */}
            <Section title="Supported Content Types" defaultOpen={false}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {[
                        {
                            type: 'VIDEO',
                            emoji: '📹',
                            desc: 'Time-synced HTML slides with narration audio & captions.',
                            nav: 'time_driven',
                        },
                        {
                            type: 'SLIDES',
                            emoji: '🖼️',
                            desc: 'HTML presentation deck with images, tables & diagrams.',
                            nav: 'user_driven',
                        },
                        {
                            type: 'QUIZ',
                            emoji: '❓',
                            desc: 'Multiple-choice question set with explanations.',
                            nav: 'user_driven',
                        },
                        {
                            type: 'STORYBOOK',
                            emoji: '📚',
                            desc: 'Page-by-page illustrated narrative.',
                            nav: 'user_driven',
                        },
                        {
                            type: 'FLASHCARDS',
                            emoji: '📇',
                            desc: 'Flip-card deck for spaced-repetition learning.',
                            nav: 'user_driven',
                        },
                        {
                            type: 'INTERACTIVE_GAME',
                            emoji: '🎮',
                            desc: 'Self-contained educational HTML game.',
                            nav: 'self_contained',
                        },
                        {
                            type: 'PUZZLE_BOOK',
                            emoji: '🧩',
                            desc: 'Crossword, word search or logic puzzles.',
                            nav: 'user_driven',
                        },
                        {
                            type: 'SIMULATION',
                            emoji: '🔬',
                            desc: 'Interactive physics/science/economics sandbox.',
                            nav: 'self_contained',
                        },
                        {
                            type: 'MAP_EXPLORATION',
                            emoji: '🗺️',
                            desc: 'Clickable SVG map with region facts.',
                            nav: 'user_driven',
                        },
                        {
                            type: 'WORKSHEET',
                            emoji: '📝',
                            desc: 'Printable or fillable homework worksheet.',
                            nav: 'user_driven',
                        },
                        {
                            type: 'CODE_PLAYGROUND',
                            emoji: '💻',
                            desc: 'In-browser coding exercise with instructions.',
                            nav: 'self_contained',
                        },
                        {
                            type: 'TIMELINE',
                            emoji: '⏳',
                            desc: 'Chronological event visualization.',
                            nav: 'user_driven',
                        },
                        {
                            type: 'CONVERSATION',
                            emoji: '💬',
                            desc: 'Dialogue-based language learning exercise.',
                            nav: 'user_driven',
                        },
                    ].map((ct) => (
                        <div
                            key={ct.type}
                            className="flex gap-2 p-2.5 rounded-md border border-border bg-muted/10 hover:bg-muted/30 transition-colors"
                        >
                            <span className="text-base shrink-0">{ct.emoji}</span>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <IC>{ct.type}</IC>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                                        {ct.nav}
                                    </span>
                                </div>
                                <p className="text-muted-foreground mt-0.5 leading-snug">
                                    {ct.desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                    <span className="font-semibold">Navigation mode</span> —
                    <IC>time_driven</IC>: auto-plays with audio &nbsp;|&nbsp;
                    <IC>user_driven</IC>: user clicks through pages &nbsp;|&nbsp;
                    <IC>self_contained</IC>: fully interactive HTML app
                </p>
            </Section>

            {/* ── Generation Stages ────────────────────────────────────────────── */}
            <Section title="Generation Stages" defaultOpen={false}>
                <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-muted/50 border-b border-border">
                                <th className="text-left px-3 py-2 font-semibold">Stage</th>
                                <th className="text-left px-3 py-2 font-semibold">Output file</th>
                                <th className="text-left px-3 py-2 font-semibold">s3_urls key</th>
                                <th className="text-left px-3 py-2 font-semibold w-1/2">
                                    Description
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                {
                                    stage: 'SCRIPT',
                                    file: 'script.txt',
                                    key: 'script',
                                    desc: 'LLM generates narration script & content plan.',
                                },
                                {
                                    stage: 'TTS',
                                    file: 'narration.mp3',
                                    key: 'audio',
                                    desc: 'Text-to-speech converts script to audio.',
                                },
                                {
                                    stage: 'WORDS',
                                    file: 'narration.words.json',
                                    key: 'words',
                                    desc: 'Word-level timestamp alignment for captions.',
                                },
                                {
                                    stage: 'HTML',
                                    file: 'time_based_frame.json',
                                    key: 'timeline',
                                    desc: '✅ Recommended stop point. HTML slides synced to audio timestamps.',
                                },
                                {
                                    stage: 'RENDER',
                                    file: 'output.mp4',
                                    key: 'video',
                                    desc: 'Full video render (slow, only needed for download/export).',
                                },
                            ].map((s, i) => (
                                <tr
                                    key={s.stage}
                                    className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}
                                >
                                    <td className="px-3 py-2">
                                        <IC>{s.stage}</IC>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-muted-foreground">
                                        {s.file}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-blue-700 dark:text-blue-400">
                                        {s.key}
                                    </td>
                                    <td className="px-3 py-2 text-foreground">{s.desc}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-muted-foreground">
                    The <IC>target_stage</IC> query parameter on <IC>POST /generate</IC> controls
                    which stage to stop at. Default is <IC>HTML</IC>.
                </p>
            </Section>

            {/* ── Endpoints ─────────────────────────────────────────────────────── */}
            <Tabs defaultValue="generate" className="w-full">
                <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/30 p-1">
                    {[
                        { value: 'generate', label: 'Generate', icon: <Zap className="size-3" /> },
                        {
                            value: 'polling',
                            label: 'REST Polling',
                            icon: <RefreshCw className="size-3" />,
                        },
                        {
                            value: 'history',
                            label: 'History',
                            icon: <History className="size-3" />,
                        },
                        {
                            value: 'status',
                            label: 'Status',
                            icon: <Info className="size-3" />,
                        },
                        { value: 'urls', label: 'URLs', icon: <Code2 className="size-3" /> },
                        {
                            value: 'frames',
                            label: 'Frame Edit',
                            icon: <FileText className="size-3" />,
                        },
                        {
                            value: 'events',
                            label: 'SSE Events',
                            icon: <Radio className="size-3" />,
                        },
                    ].map((t) => (
                        <TabsTrigger
                            key={t.value}
                            value={t.value}
                            className="flex items-center gap-1.5 text-xs"
                        >
                            {t.icon}
                            {t.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {/* ── Generate (SSE) ───────────────────────────────────────────── */}
                <TabsContent value="generate" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2 mb-1">
                                <MethodBadge method="POST" />
                                <IC>/external/video/v1/generate</IC>
                                <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                                    <Radio className="size-3" /> SSE Stream
                                </Badge>
                            </div>
                            <CardTitle>Generate Content — SSE Streaming</CardTitle>
                            <CardDescription>
                                Starts a generation job and streams real-time progress via{' '}
                                <strong>Server-Sent Events</strong>. The job runs as a background
                                task on the server — closing the connection will NOT cancel
                                generation. Use{' '}
                                <IC>GET /urls/&#123;video_id&#125;</IC> to fetch the result later.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <Section title="Query Parameters">
                                <ParamTable
                                    params={[
                                        {
                                            name: 'target_stage',
                                            type: 'string',
                                            required: false,
                                            default: 'HTML',
                                            description:
                                                'Stop generation at this stage. Recommended: HTML (full content, no render). Options: SCRIPT · TTS · WORDS · HTML · RENDER.',
                                        },
                                    ]}
                                />
                            </Section>

                            <Section title="Request Body Parameters">
                                <ParamTable params={generateParams} />
                            </Section>

                            <Section title="Code Examples">
                                <CodeBlock examples={sseExamples} />
                            </Section>

                            <Section title="Response (SSE event stream)">
                                <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground">
                                        Content-Type: <IC>text/event-stream</IC>. Each line is
                                        prefixed with <IC>data: </IC> followed by a JSON object.
                                    </p>
                                    <CodeBlock
                                        examples={[
                                            {
                                                lang: 'sse',
                                                label: 'SSE stream',
                                                code: `data: {"type":"progress","stage":"PENDING","percentage":0,"message":"VIDEO generation initialized","video_id":"vid_..."}

data: {"type":"progress","stage":"SCRIPT","percentage":10,"message":"Generating script...","video_id":"vid_...","files":{"script":{"s3_url":"https://..."}}}

data: {"type":"progress","stage":"TTS","percentage":30,"message":"Synthesizing audio...","video_id":"vid_...","files":{"audio":{"s3_url":"https://..."}}}

data: {"type":"progress","stage":"WORDS","percentage":55,"message":"Word alignment...","video_id":"vid_...","files":{"words":{"s3_url":"https://..."}}}

data: {"type":"progress","stage":"HTML","percentage":85,"message":"Generating slides...","video_id":"vid_...","files":{"timeline":{"s3_url":"https://..."}}}

data: {"type":"completed","percentage":100,"video_id":"vid_...","files":{"script":"https://...","audio":"https://...","timeline":"https://..."}}`,
                                            },
                                        ]}
                                    />
                                </div>
                            </Section>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Polling approach ─────────────────────────────────────────── */}
                <TabsContent value="polling" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2 mb-1">
                                <MethodBadge method="POST" />
                                <IC>/external/video/v1/generate</IC>
                                <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                                    <RefreshCw className="size-3" /> REST Polling
                                </Badge>
                            </div>
                            <CardTitle>Generate Content — REST Polling</CardTitle>
                            <CardDescription>
                                Simpler alternative to SSE streaming. Start the generation (you can
                                immediately close the HTTP connection — the server keeps running),
                                then periodically call{' '}
                                <IC>GET /urls/&#123;video_id&#125;</IC> until{' '}
                                <IC>html_url</IC> is populated.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-800 space-y-1 dark:border-blue-800/30 dark:bg-blue-900/10 dark:text-blue-300">
                                <p className="font-semibold flex items-center gap-1.5">
                                    <Info className="size-3.5" /> When to use polling vs SSE
                                </p>
                                <ul className="list-disc list-inside space-y-0.5 pl-1">
                                    <li>
                                        <strong>SSE</strong>: Best for UI dashboards that need live
                                        progress bars (stage %, messages).
                                    </li>
                                    <li>
                                        <strong>Polling</strong>: Best for backend scripts, cron
                                        jobs, or when you don't need real-time updates.
                                    </li>
                                    <li>
                                        Both use the same endpoint — the difference is just whether
                                        you read the response stream.
                                    </li>
                                </ul>
                            </div>

                            <Section title="Polling Flow">
                                <div className="flex flex-col gap-2 text-sm">
                                    {[
                                        {
                                            step: 1,
                                            label: 'POST /generate',
                                            desc: 'Start the job. Include a stable video_id you control.',
                                        },
                                        {
                                            step: 2,
                                            label: 'Close (or ignore) the SSE stream',
                                            desc: 'Generation continues on the server regardless.',
                                        },
                                        {
                                            step: 3,
                                            label: 'Poll GET /urls/{video_id} every 10 s',
                                            desc: 'Repeat until html_url is present.',
                                        },
                                        {
                                            step: 4,
                                            label: 'Use the returned URLs',
                                            desc: 'Pass html_url + audio_url to your player.',
                                        },
                                    ].map((s) => (
                                        <div key={s.step} className="flex gap-3">
                                            <div className="size-6 shrink-0 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold">
                                                {s.step}
                                            </div>
                                            <div>
                                                <IC>{s.label}</IC>
                                                <span className="text-muted-foreground ml-2 text-xs">
                                                    {s.desc}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Section>

                            <Section title="Code Examples">
                                <CodeBlock examples={pollingExamples} />
                            </Section>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── History ──────────────────────────────────────────────────── */}
                <TabsContent value="history" className="mt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2 mb-1">
                                <MethodBadge method="GET" />
                                <IC>/external/video/v1/history</IC>
                            </div>
                            <CardTitle>Get Generation History</CardTitle>
                            <CardDescription>
                                Returns the last N content generations for your institute, ordered
                                newest-first. Maximum 50 per request.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Section title="Query Parameters">
                                <ParamTable
                                    params={[
                                        {
                                            name: 'limit',
                                            type: 'integer',
                                            required: false,
                                            default: '10',
                                            description:
                                                'Number of items to return. Capped at 50.',
                                        },
                                    ]}
                                />
                            </Section>
                            <Section title="Code Examples">
                                <CodeBlock examples={historyExamples} />
                            </Section>
                            <Section title="Response">
                                <CodeBlock
                                    examples={[
                                        {
                                            lang: 'json',
                                            label: 'JSON',
                                            code: JSON.stringify(
                                                [
                                                    {
                                                        id: 'uuid-...',
                                                        video_id: 'vid_1234_abc',
                                                        current_stage: 'HTML',
                                                        status: 'COMPLETED',
                                                        content_type: 'VIDEO',
                                                        prompt: 'Explain photosynthesis...',
                                                        language: 'English (India)',
                                                        s3_urls: {
                                                            script: 'https://...',
                                                            audio: 'https://...',
                                                            words: 'https://...',
                                                            timeline: 'https://...',
                                                        },
                                                        error_message: null,
                                                        created_at: '2024-01-25T10:00:00Z',
                                                        updated_at: '2024-01-25T10:05:00Z',
                                                        completed_at: '2024-01-25T10:05:00Z',
                                                    },
                                                ],
                                                null,
                                                2
                                            ),
                                        },
                                    ]}
                                />
                            </Section>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Status ───────────────────────────────────────────────────── */}
                <TabsContent value="status" className="mt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2 mb-1">
                                <MethodBadge method="GET" />
                                <IC>/external/video/v1/status/&#123;video_id&#125;</IC>
                            </div>
                            <CardTitle>Get Video Status</CardTitle>
                            <CardDescription>
                                Returns the full status record for a generation including all
                                available S3 URLs. Use this to check which stages have completed.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <p className="text-sm font-medium">
                                    Status values (<IC>status</IC> field)
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                    {[
                                        {
                                            val: 'PENDING',
                                            color: 'bg-gray-100 text-gray-700',
                                            desc: 'Queued, not started',
                                        },
                                        {
                                            val: 'IN_PROGRESS',
                                            color: 'bg-blue-100 text-blue-700',
                                            desc: 'Actively generating',
                                        },
                                        {
                                            val: 'COMPLETED',
                                            color: 'bg-green-100 text-green-700',
                                            desc: 'All stages done',
                                        },
                                        {
                                            val: 'FAILED',
                                            color: 'bg-red-100 text-red-700',
                                            desc: 'Error occurred',
                                        },
                                    ].map((s) => (
                                        <div key={s.val} className={`rounded p-2 ${s.color}`}>
                                            <p className="font-mono font-semibold">{s.val}</p>
                                            <p className="mt-0.5 opacity-80">{s.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <Section title="Code Examples">
                                <CodeBlock examples={statusExamples} />
                            </Section>
                            <Section title="Response">
                                <CodeBlock
                                    examples={[
                                        {
                                            lang: 'json',
                                            label: 'JSON',
                                            code: JSON.stringify(
                                                {
                                                    id: 'uuid-...',
                                                    video_id: 'vid_1234_abc',
                                                    current_stage: 'HTML',
                                                    status: 'COMPLETED',
                                                    content_type: 'VIDEO',
                                                    prompt: 'Explain photosynthesis...',
                                                    language: 'English (India)',
                                                    s3_urls: {
                                                        script: 'https://...s3.amazonaws.com/.../script.txt',
                                                        audio: 'https://...s3.amazonaws.com/.../narration.mp3',
                                                        words: 'https://...s3.amazonaws.com/.../narration.words.json',
                                                        timeline:
                                                            'https://...s3.amazonaws.com/.../time_based_frame.json',
                                                    },
                                                    error_message: null,
                                                    created_at: '2024-01-25T10:00:00Z',
                                                    completed_at: '2024-01-25T10:05:00Z',
                                                },
                                                null,
                                                2
                                            ),
                                        },
                                    ]}
                                />
                            </Section>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── URLs ─────────────────────────────────────────────────────── */}
                <TabsContent value="urls" className="mt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2 mb-1">
                                <MethodBadge method="GET" />
                                <IC>/external/video/v1/urls/&#123;video_id&#125;</IC>
                            </div>
                            <CardTitle>Get Player URLs</CardTitle>
                            <CardDescription>
                                Returns the specific URLs needed to embed the content in a player.
                                This is the most efficient endpoint for polling — smaller response
                                than <IC>/status</IC>.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-lg border border-green-200 bg-green-50/50 p-3 text-xs text-green-800 dark:border-green-800/30 dark:bg-green-900/10 dark:text-green-300">
                                <p className="font-semibold mb-1">
                                    How to detect generation complete
                                </p>
                                <ul className="list-disc list-inside space-y-0.5">
                                    <li>
                                        <strong>VIDEO</strong>: wait for{' '}
                                        <IC>html_url != null AND audio_url != null</IC>
                                    </li>
                                    <li>
                                        <strong>SLIDES / QUIZ / etc.</strong>: wait for{' '}
                                        <IC>html_url != null</IC> (no audio required)
                                    </li>
                                    <li>
                                        <strong>Failed</strong>:{' '}
                                        <IC>status === &quot;FAILED&quot;</IC>
                                    </li>
                                </ul>
                            </div>
                            <Section title="Code Examples">
                                <CodeBlock examples={urlsExamples} />
                            </Section>
                            <Section title="Response">
                                <CodeBlock
                                    examples={[
                                        {
                                            lang: 'json',
                                            label: 'JSON',
                                            code: JSON.stringify(
                                                {
                                                    video_id: 'vid_1234_abc',
                                                    html_url: 'https://...s3.amazonaws.com/.../time_based_frame.json',
                                                    audio_url: 'https://...s3.amazonaws.com/.../narration.mp3',
                                                    words_url: 'https://...s3.amazonaws.com/.../narration.words.json',
                                                    avatar_url: null,
                                                    status: 'COMPLETED',
                                                    current_stage: 'HTML',
                                                },
                                                null,
                                                2
                                            ),
                                        },
                                    ]}
                                />
                            </Section>
                            <Section title="URL file descriptions">
                                <ParamTable
                                    params={[
                                        {
                                            name: 'html_url',
                                            type: 'string | null',
                                            required: false,
                                            description:
                                                'time_based_frame.json — array of {timestamp, html} objects. Feed to AIContentPlayer.',
                                        },
                                        {
                                            name: 'audio_url',
                                            type: 'string | null',
                                            required: false,
                                            description:
                                                'narration.mp3 — AI-synthesised narration audio.',
                                        },
                                        {
                                            name: 'words_url',
                                            type: 'string | null',
                                            required: false,
                                            description:
                                                'narration.words.json — array of {word, start, end} for caption display.',
                                        },
                                        {
                                            name: 'avatar_url',
                                            type: 'string | null',
                                            required: false,
                                            description:
                                                'avatar_video.mp4 — talking-head avatar video (if generate_avatar was true).',
                                        },
                                    ]}
                                />
                            </Section>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Frame Edit ───────────────────────────────────────────────── */}
                <TabsContent value="frames" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2 mb-1">
                                <MethodBadge method="POST" />
                                <IC>/external/video/v1/frame/regenerate</IC>
                            </div>
                            <CardTitle>Regenerate a Frame</CardTitle>
                            <CardDescription>
                                Ask the AI to rewrite the HTML of a specific slide/frame based on a
                                prompt. Returns the new HTML for <strong>preview only</strong> — does
                                not modify the timeline yet. Confirm by calling{' '}
                                <IC>/frame/update</IC>.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Section title="Request Body">
                                <ParamTable
                                    params={[
                                        {
                                            name: 'video_id',
                                            type: 'string',
                                            required: true,
                                            description: 'ID of the generated content.',
                                        },
                                        {
                                            name: 'timestamp',
                                            type: 'number',
                                            required: true,
                                            description:
                                                'Time in seconds of the frame to edit. The nearest frame will be selected.',
                                        },
                                        {
                                            name: 'user_prompt',
                                            type: 'string',
                                            required: true,
                                            description:
                                                'Instruction for how to change the frame. E.g. "Change background to dark blue and font to yellow."',
                                        },
                                    ]}
                                />
                            </Section>
                            <Section title="Code Examples">
                                <CodeBlock examples={frameRegenExamples} />
                            </Section>
                            <Section title="Response">
                                <CodeBlock
                                    examples={[
                                        {
                                            lang: 'json',
                                            label: 'JSON',
                                            code: JSON.stringify(
                                                {
                                                    video_id: 'vid_1234_abc',
                                                    frame_index: 5,
                                                    timestamp: 12.5,
                                                    original_html: '<html>…</html>',
                                                    new_html: '<html><style>body{background:darkblue}</style>…</html>',
                                                },
                                                null,
                                                2
                                            ),
                                        },
                                    ]}
                                />
                            </Section>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2 mb-1">
                                <MethodBadge method="POST" />
                                <IC>/external/video/v1/frame/update</IC>
                            </div>
                            <CardTitle>Commit Frame Update</CardTitle>
                            <CardDescription>
                                Writes the confirmed HTML change into the stored timeline
                                (time_based_frame.json). Call this after the user approves the
                                preview from <IC>/frame/regenerate</IC>.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Section title="Request Body">
                                <ParamTable
                                    params={[
                                        {
                                            name: 'video_id',
                                            type: 'string',
                                            required: true,
                                            description: 'ID of the generated content.',
                                        },
                                        {
                                            name: 'frame_index',
                                            type: 'integer',
                                            required: true,
                                            description:
                                                'Zero-based index of the frame to update. Use the value returned by /frame/regenerate.',
                                        },
                                        {
                                            name: 'new_html',
                                            type: 'string',
                                            required: true,
                                            description:
                                                'Full HTML string to store. Typically the new_html from /frame/regenerate.',
                                        },
                                    ]}
                                />
                            </Section>
                            <Section title="Code Examples">
                                <CodeBlock examples={frameUpdateExamples} />
                            </Section>
                            <Section title="Response">
                                <CodeBlock
                                    examples={[
                                        {
                                            lang: 'json',
                                            label: 'JSON',
                                            code: JSON.stringify(
                                                {
                                                    status: 'success',
                                                    video_id: 'vid_1234_abc',
                                                    updated_frame_index: 5,
                                                    message:
                                                        'Frame updated successfully. Player reflects changes immediately.',
                                                },
                                                null,
                                                2
                                            ),
                                        },
                                    ]}
                                />
                            </Section>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── SSE Event Reference ──────────────────────────────────────── */}
                <TabsContent value="events" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Radio className="size-4 text-blue-500" />
                                SSE Event Reference
                            </CardTitle>
                            <CardDescription>
                                Every event in the <IC>POST /generate</IC> SSE stream is a JSON
                                object on a <IC>data: </IC> line. There are four event types.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {/* progress */}
                            <Section title="progress — stage update">
                                <div className="space-y-3">
                                    <EventBadge type="progress" />
                                    <p className="text-xs text-muted-foreground">
                                        Emitted at the start and end of each stage. The{' '}
                                        <IC>files</IC> field is populated as each stage completes.
                                    </p>
                                    <CodeBlock
                                        examples={[
                                            {
                                                lang: 'json',
                                                label: 'JSON',
                                                code: JSON.stringify(
                                                    {
                                                        type: 'progress',
                                                        stage: 'HTML',
                                                        percentage: 85,
                                                        message: 'Generating HTML slides…',
                                                        video_id: 'vid_1234_abc',
                                                        content_type: 'VIDEO',
                                                        files: {
                                                            script: {
                                                                file_id: 'fid_...',
                                                                s3_url: 'https://...script.txt',
                                                            },
                                                            audio: {
                                                                file_id: 'fid_...',
                                                                s3_url: 'https://...narration.mp3',
                                                            },
                                                            words: {
                                                                file_id: 'fid_...',
                                                                s3_url: 'https://...words.json',
                                                            },
                                                            timeline: {
                                                                file_id: 'fid_...',
                                                                s3_url: 'https://...time_based_frame.json',
                                                            },
                                                        },
                                                    },
                                                    null,
                                                    2
                                                ),
                                            },
                                        ]}
                                    />
                                </div>
                            </Section>

                            {/* completed */}
                            <Section title="completed — generation finished">
                                <div className="space-y-3">
                                    <EventBadge type="completed" />
                                    <p className="text-xs text-muted-foreground">
                                        Final event. All requested stages are done.
                                    </p>
                                    <CodeBlock
                                        examples={[
                                            {
                                                lang: 'json',
                                                label: 'JSON',
                                                code: JSON.stringify(
                                                    {
                                                        type: 'completed',
                                                        percentage: 100,
                                                        video_id: 'vid_1234_abc',
                                                        content_type: 'VIDEO',
                                                        files: {
                                                            script: 'https://...script.txt',
                                                            audio: 'https://...narration.mp3',
                                                            words: 'https://...words.json',
                                                            timeline:
                                                                'https://...time_based_frame.json',
                                                        },
                                                    },
                                                    null,
                                                    2
                                                ),
                                            },
                                        ]}
                                    />
                                </div>
                            </Section>

                            {/* info */}
                            <Section title="info — informational message">
                                <div className="space-y-3">
                                    <EventBadge type="info" />
                                    <p className="text-xs text-muted-foreground">
                                        Non-critical status messages (e.g. skipped stages on
                                        resume).
                                    </p>
                                    <CodeBlock
                                        examples={[
                                            {
                                                lang: 'json',
                                                label: 'JSON',
                                                code: JSON.stringify(
                                                    {
                                                        type: 'info',
                                                        message: 'Skipping SCRIPT — already completed.',
                                                        video_id: 'vid_1234_abc',
                                                    },
                                                    null,
                                                    2
                                                ),
                                            },
                                        ]}
                                    />
                                </div>
                            </Section>

                            {/* error */}
                            <Section title="error — generation failed">
                                <div className="space-y-3">
                                    <EventBadge type="error" />
                                    <p className="text-xs text-muted-foreground">
                                        Sent when the pipeline fails. The <IC>stage</IC> field
                                        indicates which stage failed.
                                    </p>
                                    <CodeBlock
                                        examples={[
                                            {
                                                lang: 'json',
                                                label: 'JSON',
                                                code: JSON.stringify(
                                                    {
                                                        type: 'error',
                                                        message: 'TTS provider returned 503.',
                                                        stage: 'TTS',
                                                        video_id: 'vid_1234_abc',
                                                    },
                                                    null,
                                                    2
                                                ),
                                            },
                                        ]}
                                    />
                                </div>
                            </Section>

                            {/* heartbeat note */}
                            <div className="rounded-md border border-muted p-3 text-xs text-muted-foreground">
                                <strong>Heartbeat</strong> — every 60 s of silence the server sends
                                an SSE comment line (<IC>: heartbeat</IC>) to keep proxies alive.
                                These are not <IC>data:</IC> events and should be ignored by your
                                parser.
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* ── Error Reference ───────────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="size-4 text-red-500" />
                        HTTP Error Reference
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto rounded-md border border-border">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-muted/50 border-b border-border">
                                    <th className="text-left px-3 py-2 font-semibold">Code</th>
                                    <th className="text-left px-3 py-2 font-semibold">Meaning</th>
                                    <th className="text-left px-3 py-2 font-semibold">
                                        Common cause
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    {
                                        code: '401',
                                        meaning: 'Unauthorized',
                                        cause: 'Missing or invalid X-Institute-Key header.',
                                    },
                                    {
                                        code: '403',
                                        meaning: 'Forbidden',
                                        cause: 'API key is revoked or belongs to another institute.',
                                    },
                                    {
                                        code: '404',
                                        meaning: 'Not Found',
                                        cause: 'video_id does not exist in the database.',
                                    },
                                    {
                                        code: '422',
                                        meaning: 'Validation Error',
                                        cause: 'Missing required field or invalid parameter value.',
                                    },
                                    {
                                        code: '500',
                                        meaning: 'Internal Server Error',
                                        cause: 'Pipeline failure. Check the SSE error event for details.',
                                    },
                                ].map((e, i) => (
                                    <tr
                                        key={e.code}
                                        className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}
                                    >
                                        <td className="px-3 py-2">
                                            <Badge
                                                variant="outline"
                                                className="font-mono text-red-600 border-red-200"
                                            >
                                                {e.code}
                                            </Badge>
                                        </td>
                                        <td className="px-3 py-2 font-semibold">{e.meaning}</td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                            {e.cause}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

import { useEffect, useMemo, useState } from 'react';
import { ChartBar, CircleNotch, WarningCircle } from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { getTutorInsights, type TutorInsights } from '@/services/tutor';

const ALL = '__all__';

const fmtScore = (v: number | null) =>
    v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`;
const fmtWhen = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/**
 * What the AI teacher learned about this course's learners (design WP9):
 * usage totals, the concepts learners get wrong most (with the misconceptions
 * the teacher recorded), and a per-learner table. Read-only.
 */
export const TutorInsightsCard: React.FC<{ packageId: string }> = ({ packageId }) => {
    const [batch, setBatch] = useState<string>(ALL);
    const [days, setDays] = useState<number>(90);
    const [data, setData] = useState<TutorInsights | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getTutorInsights(packageId, { packageSessionId: batch === ALL ? undefined : batch, days })
            .then((d) => {
                if (!cancelled) setData(d);
            })
            .catch((e: unknown) => {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : 'Could not load insights');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [packageId, batch, days]);

    const weakConcepts = useMemo(
        () =>
            (data?.concepts ?? []).filter(
                (c) => c.weak_learners > 0 || (c.avg_score !== null && c.avg_score < 0.5)
            ),
        [data]
    );
    const totals = data?.totals;

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <ChartBar className="size-5 text-primary-500" />
                    What the AI teacher learned
                    {loading && <CircleNotch className="size-4 animate-spin text-neutral-400" />}
                    <span className="ms-auto flex flex-wrap items-center gap-2 text-sm font-normal">
                        <Select value={batch} onValueChange={setBatch}>
                            <SelectTrigger className="h-8 w-52">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>All batches</SelectItem>
                                {(data?.batches ?? []).map((b) => (
                                    <SelectItem
                                        key={b.package_session_id}
                                        value={b.package_session_id}
                                    >
                                        {b.name} ({b.sessions})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                            <SelectTrigger className="h-8 w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="7">Last 7 days</SelectItem>
                                <SelectItem value="30">Last 30 days</SelectItem>
                                <SelectItem value="90">Last 90 days</SelectItem>
                                <SelectItem value="365">Last year</SelectItem>
                            </SelectContent>
                        </Select>
                    </span>
                </CardTitle>
                <p className="text-sm text-neutral-500">
                    Every lesson records each answer, the concepts a learner struggled with, and the
                    misconceptions the teacher heard. Use this to see where the course needs a
                    better explanation and which learners need a human.
                </p>
            </CardHeader>
            <CardContent className="space-y-5">
                {error && (
                    <p className="flex items-center gap-2 text-sm text-danger-600">
                        <WarningCircle className="size-4" /> {error}
                    </p>
                )}
                {totals && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        {[
                            ['Lessons', totals.sessions],
                            ['Learners', totals.learners],
                            ['Minutes', totals.minutes],
                            ['Voice lessons', totals.voice_sessions],
                            ['Left mid-way', totals.abandoned],
                        ].map(([label, value]) => (
                            <div
                                key={String(label)}
                                className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2"
                            >
                                <p className="text-xs uppercase tracking-wide text-neutral-500">
                                    {label}
                                </p>
                                <p className="text-xl font-semibold text-neutral-900">{value}</p>
                            </div>
                        ))}
                    </div>
                )}

                <div>
                    <h4 className="mb-2 text-sm font-semibold text-neutral-800">
                        Concepts learners struggle with
                    </h4>
                    {!loading && weakConcepts.length === 0 && (
                        <p className="text-sm text-neutral-500">No weak spots recorded yet.</p>
                    )}
                    {weakConcepts.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-neutral-200 text-start text-xs uppercase tracking-wide text-neutral-500">
                                        <th className="py-2 pe-3 text-start">Concept</th>
                                        <th className="py-2 pe-3 text-start">Slide · board</th>
                                        <th className="py-2 pe-3 text-end">Learners weak</th>
                                        <th className="py-2 pe-3 text-end">Avg score</th>
                                        <th className="py-2 pe-3 text-start">What they said</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {weakConcepts.map((c) => (
                                        <tr
                                            key={c.concept_id}
                                            className="border-b border-neutral-100 align-top"
                                        >
                                            <td className="py-2 pe-3 font-medium text-neutral-800">
                                                {c.concept}
                                            </td>
                                            <td className="py-2 pe-3 text-neutral-600">
                                                {c.slide}
                                                <span className="text-neutral-400">
                                                    {' '}
                                                    · {c.topic}
                                                </span>
                                            </td>
                                            <td className="py-2 pe-3 text-end">
                                                <Badge
                                                    variant="outline"
                                                    className="border-warning-200 bg-warning-50 text-warning-700"
                                                >
                                                    {c.weak_learners} / {c.learners}
                                                </Badge>
                                            </td>
                                            <td className="py-2 pe-3 text-end text-neutral-700">
                                                {fmtScore(c.avg_score)}
                                            </td>
                                            <td className="py-2 pe-3 text-neutral-600">
                                                {c.misconceptions.length
                                                    ? c.misconceptions.join(' · ')
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div>
                    <h4 className="mb-2 text-sm font-semibold text-neutral-800">Learners</h4>
                    {!loading && (data?.learners.length ?? 0) === 0 && (
                        <p className="text-sm text-neutral-500">No lessons in this period.</p>
                    )}
                    {(data?.learners.length ?? 0) > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                                        <th className="py-2 pe-3 text-start">Learner</th>
                                        <th className="py-2 pe-3 text-end">Lessons</th>
                                        <th className="py-2 pe-3 text-end">Minutes</th>
                                        <th className="py-2 pe-3 text-end">Answers</th>
                                        <th className="py-2 pe-3 text-end">Avg score</th>
                                        <th className="py-2 pe-3 text-end">Weak</th>
                                        <th className="py-2 pe-3 text-end">Last lesson</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data?.learners.map((l) => (
                                        <tr key={l.user_id} className="border-b border-neutral-100">
                                            <td className="py-2 pe-3 font-medium text-neutral-800">
                                                {l.name || l.user_id.slice(0, 8)}
                                            </td>
                                            <td className="py-2 pe-3 text-end">{l.sessions}</td>
                                            <td className="py-2 pe-3 text-end">{l.minutes}</td>
                                            <td className="py-2 pe-3 text-end">{l.attempts}</td>
                                            <td className="py-2 pe-3 text-end">
                                                {fmtScore(l.avg_score)}
                                            </td>
                                            <td className="py-2 pe-3 text-end">
                                                {l.weak_attempts > 0 ? (
                                                    <span className="text-warning-700">
                                                        {l.weak_attempts}
                                                    </span>
                                                ) : (
                                                    <span className="text-neutral-400">0</span>
                                                )}
                                            </td>
                                            <td className="py-2 pe-3 text-end text-neutral-600">
                                                {fmtWhen(l.last_active)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

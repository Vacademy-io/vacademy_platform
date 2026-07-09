/*
 * StudentReportCard — the unified, parent-first "paper document" report.
 * Renders the combined v1+v2 report (facts + processed_json learning insights + narrative)
 * to pixel-match the approved prototype. Styling lives in report-card.css (scoped under .vsr).
 *
 * Shared design: an identical component exists in the learner app. Keep the two in sync.
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import type {
    V2ReportData,
    V2HeadlineMetric,
    V2BloomLevel,
    V2TopicMastery,
    V2SubjectMarksItem,
    V2SubjectPerformance,
    V2Misconception,
} from '@/types/student-analysis';
import './report-card.css';

const PLACEHOLDER_SUBJECTS = new Set([
    'unknown', 'other', 'others', 'n/a', 'na', 'general', 'misc', 'miscellaneous', '-',
]);
const isRealSubject = (s?: string | null) => {
    const v = s?.trim().toLowerCase();
    return !!v && !PLACEHOLDER_SUBJECTS.has(v);
};

const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const round = (n?: number | null) => (n == null ? null : Math.round(n));

const fmtDate = (iso?: string) => {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return iso;
    }
};

// Semantic colour tokens (CSS var references — resolved against .vsr).
const sentimentVar = (s?: string) =>
    s === 'good' ? 'var(--good)' : s === 'attention' ? 'var(--risk)' : 'var(--accent)';
const pctVar = (p?: number | null) =>
    p == null ? 'var(--accent)' : p >= 75 ? 'var(--good)' : p >= 50 ? 'var(--accent)' : p >= 35 ? 'var(--attn)' : 'var(--risk)';
const statusPalette = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('track')) return { color: 'var(--good)', soft: 'var(--good-soft)' };
    if (s.includes('risk')) return { color: 'var(--risk)', soft: 'var(--risk-soft)' };
    return { color: 'var(--attn)', soft: 'var(--attn-soft)' };
};

// ── charts ────────────────────────────────────────────────────────────────
function BloomRadar({ blooms }: { blooms: V2BloomLevel[] }) {
    const byLevel = new Map(blooms.map((b) => [b.level?.toLowerCase(), b]));
    const data = BLOOM_ORDER.map((lvl) => ({ label: cap(lvl), v: byLevel.get(lvl)?.accuracy ?? 0 }));
    const size = 230;
    const cx = size / 2;
    const cy = size / 2 + 6;
    const R = 66;
    const n = data.length;
    const ang = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
    const pt = (i: number, r: number): [number, number] => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
    const poly = (r: (i: number) => number) => data.map((_, i) => pt(i, r(i)).map((x) => x.toFixed(1)).join(',')).join(' ');
    return (
        <svg width="250" height={size} viewBox={`-46 0 322 ${size}`} role="img" aria-label="Thinking-skill radar chart">
            {[0.25, 0.5, 0.75, 1].map((f) => (
                <polygon key={f} points={poly(() => R * f)} fill="none" stroke="var(--line)" strokeWidth="1" />
            ))}
            {data.map((d, i) => {
                const [x, y] = pt(i, R);
                const [lx, ly] = pt(i, R + 20);
                const anchor = Math.abs(lx - cx) < 6 ? 'middle' : lx > cx ? 'start' : 'end';
                return (
                    <g key={d.label}>
                        <line x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke="var(--line)" strokeWidth="1" />
                        <text x={lx.toFixed(1)} y={(ly + 4).toFixed(1)} textAnchor={anchor} fontSize="10.5" fill="var(--ink-3)">
                            {d.label}
                        </text>
                    </g>
                );
            })}
            <polygon points={poly((i) => (R * (data[i]?.v ?? 0)) / 100)} fill="var(--accent)" fillOpacity="0.18" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
            {data.map((d, i) => {
                const [x, y] = pt(i, (R * d.v) / 100);
                return <circle key={d.label} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.6" fill="var(--accent)" />;
            })}
        </svg>
    );
}

function ConfidenceDonut({ knows, guesses, wrong, overall }: { knows: number; guesses: number; wrong: number; overall?: number | null }) {
    const segs = [
        { v: knows, c: 'var(--good)' },
        { v: guesses, c: 'var(--attn)' },
        { v: wrong, c: 'var(--risk)' },
    ];
    const total = segs.reduce((s, x) => s + x.v, 0) || 1;
    const r = 46;
    const C = 2 * Math.PI * r;
    const sw = 15;
    let off = 0;
    return (
        <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label="Confidence calibration donut">
            <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth={sw} />
            {segs.map((s, i) => {
                const len = (C * s.v) / total;
                const el = (
                    <circle key={i} cx="60" cy="60" r={r} fill="none" stroke={s.c} strokeWidth={sw}
                        strokeDasharray={`${len.toFixed(2)} ${(C - len).toFixed(2)}`} strokeDashoffset={(-off).toFixed(2)}
                        transform="rotate(-90 60 60)" />
                );
                off += len;
                return el;
            })}
            <text x="60" y="56" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--ink)" fontFamily="var(--mono)">
                {overall != null ? `${round(overall)}%` : '—'}
            </text>
            <text x="60" y="74" textAnchor="middle" fontSize="10.5" fill="var(--ink-3)">confidence</text>
        </svg>
    );
}

function MiniDonut({ pct, color }: { pct: number; color: string }) {
    const r = 30;
    const C = 2 * Math.PI * r;
    const len = (C * pct) / 100;
    return (
        <svg width="82" height="82" viewBox="0 0 82 82" role="img" aria-label={`${pct}%`}>
            <circle cx="41" cy="41" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
            <circle cx="41" cy="41" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${len.toFixed(1)} ${(C - len).toFixed(1)}`} transform="rotate(-90 41 41)" />
            <text x="41" y="45" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--ink)" fontFamily="var(--mono)">{pct}%</text>
        </svg>
    );
}

const StarIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L3.2 7.7l5.4-.8z" />
    </svg>
);

// ── main component ─────────────────────────────────────────────────────────
export function StudentReportCard({ data, fallbackLogoUrl }: { data: V2ReportData; fallbackLogoUrl?: string }) {
    const { meta, student, institute, period, overview } = data;
    const accent = institute?.theme_color || '#2E7D6B'; // design-lint-ignore: institute-supplied theme colour
    // Prefer the logo baked into the report; fall back to the app's institute-settings logo.
    const logoUrl = institute?.logo_url || fallbackLogoUrl || '';
    const status = statusPalette(overview?.overall_status);

    const metrics: V2HeadlineMetric[] = overview?.headline_metrics ?? [];
    const li = data.learning_insights;
    const blooms = li?.available ? li.blooms ?? [] : [];
    const topicMastery = li?.available ? li.topic_mastery ?? [] : [];
    const misconceptions = (li?.available ? li.misconceptions ?? [] : []).filter((m) => m.misconception);
    const conf = li?.confidence;

    const subjectMarks = (data.subject_marks?.subjects ?? []).filter((s) => isRealSubject(s.subject));
    const subjectPerf = (data.academics?.subject_performance ?? []).filter((s) => isRealSubject(s.subject));
    const habits = data.study_habits;
    const achievements = data.achievements ?? [];
    const narrative = data.narrative;

    // Facts sections — render everything the report actually carries (parity with the PDF).
    const attendance = data.attendance?.available ? data.attendance : undefined;
    const liveClasses = data.live_classes?.available ? data.live_classes : undefined;
    const assignments = data.assignments?.available ? data.assignments : undefined;
    const courseProgress = data.course_progress?.available ? data.course_progress : undefined;
    const doubts = data.doubts_and_engagement?.available ? data.doubts_and_engagement : undefined;
    const ai = data.ai_insights;
    const strengths = data.strengths ?? [];
    const areas = data.areas_to_improve ?? [];
    const firstName = student?.name?.split(' ')[0] ?? 'the student';

    // design-lint-ignore: dynamic institute accent → CSS custom properties on the report root
    const rootStyle = { '--accent': accent, '--accent-soft': `color-mix(in srgb, ${accent} 13%, white)` } as React.CSSProperties;

    return (
        <div className="vsr" style={rootStyle}>
            <div className="wrap">
                {/* Masthead */}
                <header className="masthead">
                    <div className="brand">
                        <div className="brand-mark">
                            <span className="brand-mark-fallback">{institute?.name?.charAt(0)?.toUpperCase() ?? 'V'}</span>
                            {logoUrl && (
                                <img
                                    src={logoUrl}
                                    alt=""
                                    onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            )}
                        </div>
                        <div>
                            <div className="brand-name">{institute?.name ?? 'Institute'}</div>
                            <div className="brand-sub">
                                {[student?.class, student?.batch].filter(Boolean).join(' · ') || 'Progress Report'}
                            </div>
                        </div>
                    </div>
                    <div className="period-pill tnum">{period?.label ?? ''}</div>
                </header>

                {/* Verdict */}
                {/* design-lint-ignore: status-driven CSS custom properties */}
                <section className="verdict" style={{ '--status-color': status.color, '--status-soft': status.soft } as React.CSSProperties}>
                    <div className="verdict-top">
                        <div>
                            <h1 className="student-name">{student?.name ?? 'Student'}</h1>
                            <div className="student-meta">
                                {[student?.roll_no && `Roll ${student.roll_no}`, student?.enrollment_no && `Enrolment ${student.enrollment_no}`,
                                meta?.generated_at && `Generated ${fmtDate(meta.generated_at)}`].filter(Boolean).join(' · ')}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            {overview?.overall_status && (
                                <span className="status-badge"><span className="status-dot" />{overview.overall_status}</span>
                            )}
                            {overview?.overall_grade && <span className="grade-chip">{overview.overall_grade}</span>}
                        </div>
                    </div>
                    {overview?.one_line && <p className="oneliner">{overview.one_line}</p>}
                    {data.parent_summary && <p className="parent-summary">{data.parent_summary}</p>}
                </section>

                {/* KPI row */}
                {metrics.length > 0 && (
                    <section className="kpi-row">
                        {metrics.map((m) => (
                            <div className="kpi" key={m.key}>
                                <div className="kpi-label">{m.label}</div>
                                <div className="kpi-val tnum">
                                    {String(m.value)}{m.unit && <span className="u">{m.unit}</span>}
                                </div>
                                {(m.change || m.trend) && (
                                    <div className={`kpi-trend ${m.trend === 'up' ? 't-up' : m.trend === 'down' ? 't-down' : 't-steady'}`}>
                                        {m.trend === 'up' ? '▲' : m.trend === 'down' ? '▼' : ''} {m.change ?? ''}
                                    </div>
                                )}
                            </div>
                        ))}
                    </section>
                )}

                {/* Attendance */}
                {attendance && (
                    <section className="section">
                        <div className="section-head">
                            <h2 className="section-title">Attendance</h2>
                            {attendance.change_vs_previous && <span className="section-note">{attendance.change_vs_previous} vs last period</span>}
                        </div>
                        <div className="card">
                            <div className="bar-row">
                                <div className="bar lg"><i style={{ width: `${round(attendance.overall_percentage) ?? 0}%`, background: pctVar(attendance.overall_percentage) }} /></div>
                                <span className="bar-val tnum">{round(attendance.overall_percentage) ?? 0}%</span>
                            </div>
                            <div className="stat-mini">
                                {attendance.present != null && <div><div className="n tnum" style={{ color: 'var(--good)' }}>{attendance.present}</div><div className="l">Present</div></div>}
                                {attendance.absent != null && <div><div className="n tnum" style={{ color: 'var(--risk)' }}>{attendance.absent}</div><div className="l">Absent</div></div>}
                                {attendance.late != null && attendance.late > 0 && <div><div className="n tnum" style={{ color: 'var(--attn)' }}>{attendance.late}</div><div className="l">Late</div></div>}
                                {attendance.total_sessions != null && <div><div className="n tnum">{attendance.total_sessions}</div><div className="l">Total sessions</div></div>}
                            </div>
                            {attendance.note && <p className="chart-cap" style={{ marginTop: 10 }}>{attendance.note}</p>}
                        </div>
                    </section>
                )}

                {/* Thinking skills */}
                {(blooms.length > 0 || conf) && (
                    <section className="section">
                        <div className="section-head">
                            <h2 className="section-title">How {firstName} Thinks</h2>
                            {li?.attempts_analyzed ? <span className="section-note">from AI analysis of {li.attempts_analyzed} recent attempts</span> : null}
                        </div>
                        <div className="grid-2">
                            {blooms.length > 0 && (
                                <div className="card">
                                    <div className="card-title">Thinking-skill profile</div>
                                    <p className="chart-cap">Accuracy across cognitive levels (Bloom's taxonomy)</p>
                                    <div style={{ display: 'grid', placeItems: 'center', marginTop: 6 }}><BloomRadar blooms={blooms} /></div>
                                </div>
                            )}
                            {conf && (
                                <div className="card">
                                    <div className="card-title">Knows vs. guesses</div>
                                    <p className="chart-cap">Confidence calibration across answered questions</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 14 }}>
                                        <ConfidenceDonut knows={conf.knows ?? 0} guesses={conf.guesses ?? 0} wrong={conf.high_confidence_wrong ?? 0} overall={conf.overall} />
                                        <div className="conf-stats" style={{ flex: 1 }}>
                                            <div className="conf-row"><span className="conf-key"><span className="swatch" style={{ background: 'var(--good)' }} />Confidently right</span><span className="conf-num">{conf.knows ?? 0}</span></div>
                                            <div className="conf-row"><span className="conf-key"><span className="swatch" style={{ background: 'var(--attn)' }} />Right but unsure</span><span className="conf-num">{conf.guesses ?? 0}</span></div>
                                            <div className="conf-row"><span className="conf-key"><span className="swatch" style={{ background: 'var(--risk)' }} />Confidently wrong</span><span className="conf-num">{conf.high_confidence_wrong ?? 0}</span></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Topic mastery */}
                {topicMastery.length > 0 && (
                    <section className="section">
                        <div className="section-head">
                            <h2 className="section-title">Topic Mastery</h2>
                            <span className="section-note">accuracy per topic, all attempts this period</span>
                        </div>
                        <div className="card">
                            {topicMastery.map((t: V2TopicMastery) => (
                                <div className="topic" key={t.topic}>
                                    <div><div className="topic-name">{t.topic}</div>{t.mastery_level && <div className="topic-lvl">{t.mastery_level}</div>}</div>
                                    <div className="bar"><i style={{ width: `${round(t.accuracy) ?? 0}%`, background: pctVar(t.accuracy) }} /></div>
                                    <div className="topic-pct tnum">{round(t.accuracy) ?? 0}%</div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Subjects */}
                {(subjectMarks.length > 0 || subjectPerf.length > 0) && (
                    <section className="section">
                        <div className="section-head">
                            <h2 className="section-title">Marks by Subject</h2>
                            <span className="section-note">across assessments, assignments, quizzes &amp; questions</span>
                        </div>
                        <div className="card">
                            {subjectMarks.length > 0 && (
                                <div className="subj-grid">
                                    {subjectMarks.map((s: V2SubjectMarksItem) => (
                                        <div className="subj" key={s.subject}>
                                            <MiniDonut pct={round(s.percentage) ?? 0} color={pctVar(s.percentage)} />
                                            <div className="subj-name">{s.subject}</div>
                                            {s.marks_obtained != null && s.total_marks != null && (
                                                <div className="subj-marks">{s.marks_obtained} / {s.total_marks}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {subjectPerf.length > 0 && (
                                <div style={{ marginTop: subjectMarks.length > 0 ? 18 : 0, borderTop: subjectMarks.length > 0 ? '1px solid var(--line)' : 'none', paddingTop: 6 }}>
                                    <p className="chart-cap" style={{ marginBottom: 6 }}>Subject performance vs. class average</p>
                                    {subjectPerf.map((sp: V2SubjectPerformance) => (
                                        <div className="subj-vs" key={sp.subject}>
                                            <span style={{ fontWeight: 500 }}>{sp.subject}</span>
                                            <div className="bar" style={{ position: 'relative' }}>
                                                <i style={{ width: `${round(sp.score_percentage) ?? 0}%`, background: sentimentVar(sp.sentiment) }} />
                                                {sp.class_average != null && (
                                                    <span style={{ position: 'absolute', top: -3, bottom: -3, left: `${round(sp.class_average)}%`, width: 2, background: 'var(--ink-2)', borderRadius: 2 }} />
                                                )}
                                            </div>
                                            <span className="tnum" style={{ color: 'var(--ink-3)', minWidth: 118, textAlign: 'right' }}>
                                                {round(sp.score_percentage)}%{sp.class_average != null && <> · cls {round(sp.class_average)}%</>}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Strengths / Areas to improve */}
                {(strengths.length > 0 || areas.length > 0) && (
                    <section className="section">
                        <div className="grid-2">
                            {strengths.length > 0 && (
                                <div className="card">
                                    <div className="mini-title">Strengths</div>
                                    {strengths.map((s, i) => (
                                        <div className="subj-vs" key={i} style={{ gridTemplateColumns: '1fr auto' }}>
                                            <span style={{ fontWeight: 500 }}>{s.topic}</span>
                                            <span className="tnum" style={{ color: 'var(--good)', fontWeight: 650 }}>{round(s.confidence) ?? 0}%</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {areas.length > 0 && (
                                <div className="card">
                                    <div className="mini-title">Areas to Improve</div>
                                    {areas.map((s, i) => (
                                        <div className="subj-vs" key={i} style={{ gridTemplateColumns: '1fr auto' }}>
                                            <span style={{ fontWeight: 500 }}>{s.topic}</span>
                                            <span className="tnum" style={{ color: 'var(--risk)', fontWeight: 650 }}>{round(s.confidence) ?? 0}%</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* What to work on */}
                {misconceptions.length > 0 && (
                    <section className="section">
                        <div className="section-head">
                            <h2 className="section-title">What to Work On Next</h2>
                            <span className="section-note">specific misconceptions + how to fix them</span>
                        </div>
                        <div className="card">
                            {misconceptions.map((m: V2Misconception, i) => (
                                <div className="fix" key={i}>
                                    <div className="fix-ico">{i + 1}</div>
                                    <div className="fix-body">
                                        {m.topic && <div className="fix-topic">{m.topic}</div>}
                                        <div className="fix-mis">{m.misconception}</div>
                                        {m.remediation && <div className="fix-rem">{m.remediation}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Habits + achievements */}
                {(habits?.available || achievements.length > 0) && (
                    <section className="section">
                        <div className="grid-2">
                            {habits?.available && (
                                <div className="card">
                                    <div className="card-title">Study habits</div>
                                    <p className="chart-cap">Daily study minutes this period</p>
                                    <div className="habit-top" style={{ marginTop: 12 }}>
                                        {habits.longest_streak_days != null && (
                                            <div className="habit-stat"><div className="n tnum">{habits.longest_streak_days}<span style={{ fontSize: 13, color: 'var(--ink-3)' }}> days</span></div><div className="l">Longest streak</div></div>
                                        )}
                                        {habits.consistency_rating && (
                                            <div className="habit-stat"><div className="n" style={{ color: 'var(--good)' }}>{habits.consistency_rating}</div><div className="l">Consistency</div></div>
                                        )}
                                        {habits.active_days != null && habits.total_days != null && (
                                            <div className="habit-stat"><div className="n tnum">{habits.active_days}</div><div className="l">Active days / {habits.total_days}</div></div>
                                        )}
                                    </div>
                                    {(habits.daily_study_minutes?.length ?? 0) > 0 && <Sparkline mins={habits.daily_study_minutes!.map((d) => d.minutes ?? 0)} />}
                                </div>
                            )}
                            {achievements.length > 0 && (
                                <div className="card">
                                    <div className="card-title">Achievements</div>
                                    <p className="chart-cap">Badges &amp; certificates earned</p>
                                    <div className="badges" style={{ marginTop: 14 }}>
                                        {achievements.map((a, i) => (
                                            <span className="badge" key={i}><StarIcon />{a.title}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Course progress */}
                {courseProgress && (
                    <section className="section">
                        <div className="section-head">
                            <h2 className="section-title">Course Progress</h2>
                            <span className="section-note">{round(courseProgress.overall_completion_percentage) ?? 0}% complete overall</span>
                        </div>
                        <div className="card">
                            <div className="bar-row">
                                <div className="bar lg"><i style={{ width: `${round(courseProgress.overall_completion_percentage) ?? 0}%`, background: 'var(--accent)' }} /></div>
                                <span className="bar-val tnum">{round(courseProgress.overall_completion_percentage) ?? 0}%</span>
                            </div>
                            {(courseProgress.subjects ?? []).map((s, i) => (
                                <div className="subj-vs" key={i} style={{ gridTemplateColumns: '132px 1fr auto' }}>
                                    <span style={{ fontWeight: 500 }}>{s.subject}</span>
                                    <div className="bar"><i style={{ width: `${round(s.completion_percentage) ?? 0}%`, background: pctVar(s.completion_percentage) }} /></div>
                                    <span className="tnum" style={{ color: 'var(--ink-3)', minWidth: 42, textAlign: 'right' }}>{round(s.completion_percentage) ?? 0}%</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Live classes + Assignments */}
                {(liveClasses || assignments) && (
                    <section className="section">
                        <div className="grid-2">
                            {liveClasses && (
                                <div className="card">
                                    <div className="mini-title">Live Classes</div>
                                    <div className="statlist">
                                        <div className="stat"><span className="stat-k">Total classes</span><span className="stat-v tnum">{liveClasses.total ?? 0}</span></div>
                                        <div className="stat"><span className="stat-k">Attended</span><span className="stat-v good tnum">{liveClasses.attended ?? 0}</span></div>
                                        <div className="stat"><span className="stat-k">Missed</span><span className="stat-v risk tnum">{liveClasses.missed ?? 0}</span></div>
                                        <div className="stat"><span className="stat-k">Attendance</span><span className="stat-v tnum">{round(liveClasses.attendance_percentage) ?? 0}%</span></div>
                                    </div>
                                </div>
                            )}
                            {assignments && (
                                <div className="card">
                                    <div className="mini-title">Assignments</div>
                                    <div className="statlist">
                                        {assignments.assigned != null && assignments.assigned > 0 && <div className="stat"><span className="stat-k">Assigned</span><span className="stat-v tnum">{assignments.assigned}</span></div>}
                                        <div className="stat"><span className="stat-k">Submitted</span><span className="stat-v good tnum">{assignments.submitted ?? 0}</span></div>
                                        <div className="stat"><span className="stat-k">On time</span><span className="stat-v tnum">{assignments.on_time ?? 0}</span></div>
                                        {assignments.late != null && assignments.late > 0 && <div className="stat"><span className="stat-k">Late</span><span className="stat-v attn tnum">{assignments.late}</span></div>}
                                        {assignments.pending != null && assignments.pending > 0 && <div className="stat"><span className="stat-k">Pending</span><span className="stat-v risk tnum">{assignments.pending}</span></div>}
                                        {assignments.avg_score_percentage != null && <div className="stat"><span className="stat-k">Avg. score</span><span className="stat-v tnum">{round(assignments.avg_score_percentage)}%</span></div>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Doubts & engagement */}
                {doubts && (
                    <section className="section">
                        <div className="section-head"><h2 className="section-title">Doubts &amp; Engagement</h2></div>
                        <div className="card">
                            <div className="statlist">
                                <div className="stat"><span className="stat-k">Questions asked</span><span className="stat-v tnum">{doubts.questions_asked ?? 0}</span></div>
                                <div className="stat"><span className="stat-k">Resolved</span><span className="stat-v good tnum">{doubts.resolved ?? 0}</span></div>
                                {doubts.avg_resolution_hours != null && doubts.avg_resolution_hours > 0 && <div className="stat"><span className="stat-k">Avg. resolution time</span><span className="stat-v tnum">{round(doubts.avg_resolution_hours)} hrs</span></div>}
                            </div>
                            {doubts.note && <p className="chart-cap" style={{ marginTop: 10 }}>{doubts.note}</p>}
                        </div>
                    </section>
                )}

                {/* AI insights: what we noticed + recommended next steps + summary */}
                {ai && ((ai.cross_domain_insights?.length ?? 0) > 0 || (ai.recommendations?.length ?? 0) > 0 || ai.summary) && (
                    <section className="section">
                        {(ai.cross_domain_insights?.length ?? 0) > 0 && (
                            <div className="card" style={{ marginBottom: 16 }}>
                                <div className="mini-title">What we noticed</div>
                                <ul className="insights">
                                    {ai.cross_domain_insights.map((c, i) => <li key={i}>{c}</li>)}
                                </ul>
                            </div>
                        )}
                        {(ai.recommendations?.length ?? 0) > 0 && (
                            <div className="card" style={{ marginBottom: ai.summary ? 16 : 0 }}>
                                <div className="mini-title">Recommended next steps</div>
                                {ai.recommendations.map((rec, i) => {
                                    const p = (rec.priority || '').toLowerCase();
                                    const pc = p.includes('high') ? 'high' : p.includes('low') ? 'low' : 'medium';
                                    return (
                                        <div className="rec" key={i}>
                                            <span className={`pri ${pc}`}>{rec.priority || 'Medium'}</span>
                                            <div>
                                                {rec.area && <div className="rec-area">{rec.area}</div>}
                                                <div className="rec-sug">{rec.suggestion}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {ai.summary && (
                            <div className="card">
                                <div className="mini-title">AI summary</div>
                                <p className="ai-summary">{ai.summary}</p>
                            </div>
                        )}
                    </section>
                )}

                {/* Detailed analysis */}
                {narrative && (narrative.progress || narrative.student_efforts || narrative.learning_frequency || narrative.remedial_points || narrative.topics_of_improvement || narrative.topics_of_degradation) && (
                    <section className="section">
                        <details className="deep">
                            <summary>Detailed analysis <span className="chev">▸</span></summary>
                            <div className="deep-body">
                                <NarrativeBlock title="Learning frequency" md={narrative.learning_frequency} />
                                <NarrativeBlock title="Progress" md={narrative.progress} />
                                <NarrativeBlock title="Effort vs. output" md={narrative.student_efforts} />
                                <NarrativeBlock title="Topics improving" md={narrative.topics_of_improvement} />
                                <NarrativeBlock title="Topics needing attention" md={narrative.topics_of_degradation} />
                                <NarrativeBlock title="Action checklist" md={narrative.remedial_points} />
                            </div>
                        </details>
                    </section>
                )}

                {data.data_notes && data.data_notes.length > 0 && (
                    <p className="footnote">{data.data_notes.map((n, i) => <React.Fragment key={i}>{n}<br /></React.Fragment>)}</p>
                )}
            </div>
        </div>
    );
}

function Sparkline({ mins }: { mins: number[] }) {
    const max = Math.max(...mins, 1);
    return (
        <div className="spark">
            {mins.map((m, i) => (
                <i key={i} className={m === 0 ? 'zero' : ''} style={{ height: `${m === 0 ? 4 : Math.round((m / max) * 100)}%` }} title={`${m} min`} />
            ))}
        </div>
    );
}

function NarrativeBlock({ title, md }: { title: string; md?: string }) {
    if (!md || !md.trim()) return null;
    return (
        <>
            <h3>{title}</h3>
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{md}</ReactMarkdown>
        </>
    );
}

import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getPublicUrl } from '@/services/upload_file';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import type { LearnerTourKey } from '@/types/student-display-settings';

/**
 * Institute-branded, print-ready HTML for the "Learner App How-To Guide" PDF,
 * rendered server-side by admin-core-service /institute/v1/tutorial-guide/render-pdf.
 *
 * KEEP IN SYNC with the learner app's copy
 * (frontend-learner-dashboard-app/src/lib/tours/guide-html.ts) — both portals
 * must produce the same document for the same enabled checkpoints.
 */

const RENDER_PDF_URL = `${BASE_URL}/admin-core-service/institute/v1/tutorial-guide/render-pdf`;

// Print palette for the generated PDF document (rendered by openhtmltopdf on
// the backend) — this is not app UI, so Tailwind tokens do not exist here.
const PDF_INK = '#1f2937'; // design-lint-ignore
const PDF_HEADING = '#111827'; // design-lint-ignore
const PDF_STRONG = '#374151'; // design-lint-ignore
const PDF_MUTED = '#6b7280'; // design-lint-ignore
const PDF_FAINT = '#9ca3af'; // design-lint-ignore
const PDF_BORDER = '#e5e7eb'; // design-lint-ignore
const PDF_WHITE = '#ffffff'; // design-lint-ignore
const PDF_TIP_BG = '#fdf5ee'; // design-lint-ignore
const PDF_DEFAULT_ACCENT = '#ED7424'; // design-lint-ignore

export interface TutorialGuideBranding {
    instituteName: string;
    logoUrl?: string | null;
    accentColor?: string | null;
}

interface GuideChapter {
    key: LearnerTourKey;
    title: string;
    intro: string;
    steps: string[];
    tips: string[];
}

function esc(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildChapters(): GuideChapter[] {
    const course = getTerminology(ContentTerms.Course, SystemTerms.Course);
    const courses = getTerminologyPlural(ContentTerms.Course, SystemTerms.Course);
    const slide = getTerminology(ContentTerms.Slide, SystemTerms.Slide);
    const slides = getTerminologyPlural(ContentTerms.Slide, SystemTerms.Slide);
    const chapter = getTerminology(ContentTerms.Chapter, SystemTerms.Chapter);
    const chapters = getTerminologyPlural(ContentTerms.Chapter, SystemTerms.Chapter);
    const liveClass = getTerminology(ContentTerms.LiveSession, SystemTerms.LiveSession);
    const liveClasses = getTerminologyPlural(ContentTerms.LiveSession, SystemTerms.LiveSession);

    const lc = (s: string) => s.toLowerCase();

    return [
        {
            key: 'dashboard-overview',
            title: 'Getting Around the App',
            intro: 'Everything in the app is reachable from two places: your dashboard (the home screen) and the main navigation menu.',
            steps: [
                'Sign in with the credentials shared by your institute. If you forget your password, use the "Forgot password" link on the login screen to reset it.',
                'After signing in you land on the Dashboard. It shows what needs your attention first: continue-learning shortcuts, upcoming schedules, and your recent activity.',
                `Open the navigation menu (the sidebar on a computer, or the menu button in the corner on a phone). From here you can reach your ${lc(courses)}, assessments, ${lc(liveClasses)} and reports.`,
                'The bell icon in the top bar shows notifications from your institute. A number badge means something new is waiting for you.',
                'Your profile menu (top-right corner) lets you view your details, change your password, and sign out.',
                'The Help button (question-mark icon) in the top bar replays interactive tutorials for any of these features whenever you need a refresher.',
            ],
            tips: [
                'Add the app to your phone home screen (or install the mobile app if your institute provides one) so you are one tap away from class.',
                'Allow notifications when the app asks — schedule changes and announcements arrive there first.',
            ],
        },
        {
            key: 'browse-courses',
            title: `Browsing and Opening ${courses}`,
            intro: `Your learning library holds every ${lc(course)} you are enrolled in, organised so you can always pick up where you left off.`,
            steps: [
                `Open Learning Center from the navigation menu to see all your ${lc(courses)}. Each card shows the ${lc(course)} name, cover image and your progress so far.`,
                `Tap a ${lc(course)} card to open it. The outline view lists its subjects and modules in the order you are meant to study them.`,
                `Expand a module to see its ${lc(chapters)}. A ${lc(chapter)} groups related lessons together.`,
                `Open any ${lc(chapter)} to see its ${lc(slides)} — videos, documents, quizzes and assignments appear in sequence.`,
                `Use the progress bar on each ${lc(course)} card to see how much you have completed. Progress updates automatically as you study.`,
                `To return to a ${lc(course)} later, use the "Continue learning" section on your dashboard — it takes you straight to your last position.`,
            ],
            tips: [
                `New ${lc(courses)} appear automatically when your institute enrols you — there is nothing to activate.`,
                'If a card looks locked, the content may be released on a schedule. Check back on the release date or ask your teacher.',
            ],
        },
        {
            key: 'watch-content',
            title: `Watching Videos and Studying ${slides}`,
            intro: `Lessons are delivered as ${lc(slides)}: videos, readings, quizzes and practice activities that you work through in order.`,
            steps: [
                `Open a ${lc(chapter)} and tap the first ${lc(slide)} to start studying. The viewer opens with the lesson content front and center.`,
                'For videos, use the player controls to pause, rewind ten seconds, change playback speed, or go full screen.',
                `Move between ${lc(slides)} with the next/previous arrows, or jump to any ${lc(slide)} from the list at the side.`,
                `A checkmark appears on each ${lc(slide)} you complete. Videos count as complete when you have watched them through.`,
                'Some lessons include quick quizzes. Answer each question to continue — they help you check your understanding as you go.',
                'If you have a question about a lesson, use the doubt/help option in the viewer to ask your teacher directly from that lesson.',
                'Your watch time and completion are saved automatically, even if you close the app mid-lesson.',
            ],
            tips: [
                'Studying on a slow connection? Lower the video quality from the player settings for smoother playback.',
                'Short, regular study sessions beat marathon ones — the app tracks your daily streak to help you stay consistent.',
            ],
        },
        {
            key: 'take-assessment',
            title: 'Taking an Assessment',
            intro: 'Assessments are timed tests assigned by your institute. Everything from starting an attempt to reviewing results happens in the app.',
            steps: [
                'Open Assessments from the navigation menu. Tests are grouped by status: live (open now), upcoming, and past.',
                'Tap an assessment to see its details — subject, number of questions, total marks, duration and the attempt window.',
                'Read the instructions carefully, then tap Start when you are ready. The timer begins immediately and keeps running even if you close the app.',
                'Answer questions using the on-screen options. Use the question palette to jump between questions and see which ones are answered, skipped or marked for review.',
                'Mark tricky questions for review and come back to them before time runs out.',
                'Tap Submit when you are done. If the timer expires first, your attempt is submitted automatically with the answers you have saved.',
                'After results are released, open the assessment again (or go to Reports) to see your score, correct answers and explanations.',
            ],
            tips: [
                'Join a few minutes early with a charged device and stable internet — the timer does not pause for connection problems.',
                'Do not switch apps during a proctored test; it may be flagged or end your attempt, depending on your institute’s rules.',
            ],
        },
        {
            key: 'join-live-class',
            title: `Joining a ${liveClass}`,
            intro: `${liveClasses} are scheduled sessions taught in real time. The app shows you the schedule and gets you into the room in one tap.`,
            steps: [
                `Open ${liveClasses} from the navigation menu (under Learning Center). Today's sessions appear first, followed by the upcoming schedule.`,
                'Each card shows the topic, teacher, start time and duration, so you know exactly what is coming up.',
                'When a session is live, its card shows a Join button. Tap it and the class opens right in the app.',
                'Allow microphone (and camera, if asked) permissions the first time — your teacher controls when participants can speak.',
                'Use the in-class chat to ask questions, and the raise-hand option if your teacher has enabled it.',
                'If you get disconnected, come back to the same card and tap Join again — you will re-enter the ongoing session.',
                'Missed a class? Recordings appear in the same place after the session, whenever your institute shares them.',
            ],
            tips: [
                'Turn on notifications to get a reminder before each session starts.',
                'Headphones noticeably improve audio quality in live sessions.',
            ],
        },
        {
            key: 'view-progress',
            title: 'Tracking Your Learning Progress',
            intro: 'The app keeps a running record of everything you study and every test you take, so you always know where you stand.',
            steps: [
                'Open Reports (under Assessments) to see every assessment you have attempted, with marks, percentile and rank where available.',
                'Tap any attempt to open the detailed report — question-by-question review with correct answers and explanations once results are released.',
                `Your dashboard's analytics widgets chart daily study time, ${lc(courses)} completion and activity trends across the week.`,
                'Daily streaks track how consistently you study. Keep the streak alive by completing at least one activity a day.',
                `Each ${lc(course)}'s progress bar shows completion; open the ${lc(course)} to see exactly which ${lc(chapters)} remain.`,
                `Certificates (when your institute enables them) unlock automatically once you cross the completion threshold — look for the certificate option inside the completed ${lc(course)}.`,
            ],
            tips: [
                'Review wrong answers within a day or two of getting results — that is when the review sticks best.',
                'A few minutes of progress-checking every week helps you catch weak areas before exams do.',
            ],
        },
    ];
}

export function buildTutorialGuideHtml(
    enabledSections: string[],
    branding: TutorialGuideBranding
): string {
    const accent = branding.accentColor?.trim() || PDF_DEFAULT_ACCENT;
    const instituteName = esc(branding.instituteName || 'Your Institute');
    const chapters = buildChapters().filter((c) => enabledSections.includes(c.key));
    const generatedOn = new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const logoBlock = branding.logoUrl
        ? `<img src="${esc(branding.logoUrl)}" alt="${instituteName}" style="width:72px;height:72px;border-radius:16px;object-fit:contain;" />`
        : '';

    const tocItems = chapters
        .map((c, i) => `<li><span class="toc-num">${i + 1}</span>${esc(c.title)}</li>`)
        .join('');

    const chapterBlocks = chapters
        .map((c, i) => {
            const steps = c.steps
                .map(
                    (s, j) =>
                        `<li><span class="step-num">${j + 1}</span><span class="step-text">${esc(s)}</span></li>`
                )
                .join('');
            const tips = c.tips.map((t) => `<li>${esc(t)}</li>`).join('');
            return `
      <section class="chapter">
        <div class="chapter-kicker">Chapter ${i + 1}</div>
        <h2>${esc(c.title)}</h2>
        <p class="chapter-intro">${esc(c.intro)}</p>
        <ol class="steps">${steps}</ol>
        <div class="tips">
          <div class="tips-title">Tips</div>
          <ul>${tips}</ul>
        </div>
      </section>`;
        })
        .join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${instituteName} - Learner App Guide</title>
<style>
  @page {
    size: A4;
    margin: 18mm 16mm 22mm 16mm;
    @bottom-center {
      content: "${instituteName.replace(/"/g, "'")} - Learner App Guide  |  Page " counter(page) " of " counter(pages);
      font-size: 8.5pt;
      color: ${PDF_FAINT};
    }
  }
  body {
    font-family: Helvetica, Arial, sans-serif;
    color: ${PDF_INK};
    font-size: 10.5pt;
    line-height: 1.55;
    margin: 0;
  }
  .cover {
    text-align: center;
    padding-top: 60mm;
    page-break-after: always;
  }
  .cover .institute {
    margin-top: 16px;
    font-size: 15pt;
    font-weight: bold;
    color: ${PDF_STRONG};
  }
  .cover h1 {
    font-size: 27pt;
    margin: 10px 0 6px 0;
    color: ${accent};
  }
  .cover .subtitle {
    font-size: 11.5pt;
    color: ${PDF_MUTED};
    margin: 0 0 18px 0;
  }
  .cover .rule {
    width: 64px;
    height: 4px;
    background: ${accent};
    margin: 0 auto;
    border-radius: 2px;
  }
  .cover .date {
    margin-top: 24px;
    font-size: 9.5pt;
    color: ${PDF_FAINT};
  }
  .toc {
    page-break-after: always;
  }
  .toc h2, .chapter h2 {
    font-size: 17pt;
    color: ${PDF_HEADING};
    margin: 0 0 4px 0;
  }
  .toc .toc-intro {
    color: ${PDF_MUTED};
    margin: 6px 0 14px 0;
  }
  .toc ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .toc li {
    padding: 7px 0;
    border-bottom: 1px solid ${PDF_BORDER};
    font-size: 11.5pt;
  }
  .toc-num {
    display: inline-block;
    width: 22px;
    height: 22px;
    line-height: 22px;
    text-align: center;
    background: ${accent};
    color: ${PDF_WHITE};
    border-radius: 50%;
    font-size: 9.5pt;
    font-weight: bold;
    margin-right: 10px;
  }
  .chapter {
    page-break-before: always;
  }
  .chapter-kicker {
    font-size: 9pt;
    font-weight: bold;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: ${accent};
    margin-bottom: 2px;
  }
  .chapter-intro {
    color: ${PDF_MUTED};
    margin: 4px 0 14px 0;
  }
  ol.steps {
    list-style: none;
    padding: 0;
    margin: 0 0 16px 0;
  }
  ol.steps li {
    margin: 0 0 10px 0;
  }
  .step-num {
    display: inline-block;
    width: 20px;
    height: 20px;
    line-height: 20px;
    text-align: center;
    border: 1.5pt solid ${accent};
    color: ${accent};
    border-radius: 50%;
    font-size: 9pt;
    font-weight: bold;
    margin-right: 9px;
    vertical-align: top;
  }
  .step-text {
    display: inline-block;
    width: 88%;
    vertical-align: top;
  }
  .tips {
    background: ${PDF_TIP_BG};
    border-left: 3pt solid ${accent};
    border-radius: 6px;
    padding: 10px 14px;
  }
  .tips-title {
    font-weight: bold;
    color: ${accent};
    font-size: 9.5pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  .tips ul {
    margin: 0;
    padding-left: 16px;
  }
  .tips li {
    margin-bottom: 4px;
  }
</style>
</head>
<body>
  <div class="cover">
    ${logoBlock}
    <div class="institute">${instituteName}</div>
    <h1>Learner App Guide</h1>
    <p class="subtitle">A step-by-step handbook for studying, assessments and live classes</p>
    <div class="rule"></div>
    <div class="date">Generated on ${esc(generatedOn)}</div>
  </div>
  <div class="toc">
    <h2>In this guide</h2>
    <p class="toc-intro">Each chapter walks through one part of the app with numbered steps you can follow along on your device.</p>
    <ul>${tocItems}</ul>
  </div>
  ${chapterBlocks}
</body>
</html>`;
}

async function resolveBranding(): Promise<TutorialGuideBranding> {
    const details = useInstituteDetailsStore.getState().instituteDetails;
    const instituteName = details?.institute_name || 'Your Institute';

    let logoUrl: string | null = null;
    try {
        if (details?.institute_logo_file_id) {
            logoUrl = await getPublicUrl(details.institute_logo_file_id);
        }
    } catch {
        // Cover page simply omits the logo
    }

    // Must be hex: openhtmltopdf (the PDF renderer) does not parse hsl().
    let accentColor: string | null = null;
    try {
        const raw = getComputedStyle(document.documentElement)
            .getPropertyValue('--primary-500')
            .trim();
        if (raw) accentColor = hslTripletToHex(raw);
    } catch {
        // fall back to the builder's default accent
    }

    return { instituteName, logoUrl, accentColor };
}

// Converts a shadcn-style HSL triplet ("24 85% 54%" or "24, 85%, 54%") to hex.
function hslTripletToHex(raw: string): string | null {
    const parts = raw.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
    if (parts.length < 3) return null;
    const h = parseFloat(parts[0]!);
    const s = parseFloat(parts[1]!) / 100;
    const l = parseFloat(parts[2]!) / 100;
    if ([h, s, l].some((n) => Number.isNaN(n))) return null;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r1, g1, b1] =
        h < 60 ? [c, x, 0]
        : h < 120 ? [x, c, 0]
        : h < 180 ? [0, c, x]
        : h < 240 ? [0, x, c]
        : h < 300 ? [x, 0, c]
        : [c, 0, x];
    const toHex = (v: number) =>
        Math.round((v + m) * 255)
            .toString(16)
            .padStart(2, '0');
    return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

/**
 * Compose the guide from the given tutorial checkpoints, render it via
 * admin-core-service, and hand the PDF to the browser as a download.
 */
export async function downloadTutorialGuidePdf(enabledTours: string[]): Promise<void> {
    const branding = await resolveBranding();
    const html = buildTutorialGuideHtml(enabledTours, branding);
    const fileName = `${branding.instituteName.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}-learner-app-guide.pdf`;

    const response = await authenticatedAxiosInstance.post(
        RENDER_PDF_URL,
        { html, file_name: fileName },
        { responseType: 'blob' }
    );

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

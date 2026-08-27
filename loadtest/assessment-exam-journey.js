/**
 * k6 load test: full learner exam journey against prod-shaped infra.
 *
 * Models what real exams do to the platform end to end:
 *   login burst (auth_service) -> start-preview + start (assessment_service,
 *   one internal HMAC user-details call to auth per learner per pod) ->
 *   60s autosave syncs (assessment-DB-authenticated, triggers async marks
 *   recalc) -> submit wave (synchronous full marks calculation).
 *
 * Each VU is one learner running the journey exactly once, with login and
 * start jittered across configurable windows so the burst shape matches a
 * real exam (everyone piles in around T0) instead of a uniform rps stream.
 *
 * Usage (see RUNBOOK.md for the full procedure and safety gates):
 *   k6 run assessment-exam-journey.js \
 *     -e BASE_URL=https://backend-stage.vacademy.io \
 *     -e INSTITUTE_ID=<load-test institute uuid> \
 *     -e ASSESSMENT_ID=<load-test assessment uuid> \
 *     -e BATCH_IDS=<batch uuid[,uuid]> \
 *     -e USER_PREFIX=loadtest -e PASSWORD='LoadTest@123' \
 *     -e VUS=300 -e LOGIN_WINDOW=300 -e START_WINDOW=120 \
 *     -e EXAM_MINUTES=10 -e SYNC_INTERVAL=60
 *
 * Requires ./attempt-template.json — a REAL attempt_data dump from one manual
 * run of the load-test assessment (RUNBOOK step 4). Do not skip it: with a
 * wrong shape the scoring pass exits early and the test under-reports load.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'https://backend-stage.vacademy.io';
const INSTITUTE_ID = __ENV.INSTITUTE_ID;
const ASSESSMENT_ID = __ENV.ASSESSMENT_ID;
const BATCH_IDS = __ENV.BATCH_IDS || '';
const USER_PREFIX = __ENV.USER_PREFIX || 'loadtest';
const PASSWORD = __ENV.PASSWORD || 'LoadTest@123';
const VUS = Number(__ENV.VUS || 50);
const LOGIN_WINDOW = Number(__ENV.LOGIN_WINDOW || 300); // secs learners spread logins over
const START_WINDOW = Number(__ENV.START_WINDOW || 120); // secs after login window learners hit start
const EXAM_MINUTES = Number(__ENV.EXAM_MINUTES || 10);
const SYNC_INTERVAL = Number(__ENV.SYNC_INTERVAL || 60); // matches the app's autosave cadence

const attemptTemplate = open('./attempt-template.json');

export const options = {
    scenarios: {
        exam: {
            executor: 'per-vu-iterations',
            vus: VUS,
            iterations: 1,
            maxDuration: `${LOGIN_WINDOW + START_WINDOW + EXAM_MINUTES * 60 + 600}s`,
            gracefulStop: '120s',
        },
    },
    thresholds: {
        // Abort-worthy: an exam is unusable past these.
        'http_req_failed': ['rate<0.02'],
        'login_ms': ['p(95)<3000'],
        'start_ms': ['p(95)<5000'],
        'sync_ms': ['p(95)<2000'],
        'submit_ms': ['p(95)<8000'],
    },
};

const loginMs = new Trend('login_ms');
const previewMs = new Trend('preview_ms');
const startMs = new Trend('start_ms');
const syncMs = new Trend('sync_ms');
const submitMs = new Trend('submit_ms');
const journeyFailed = new Rate('journey_failed');
const stepFailures = new Counter('step_failures');

function jsonHeaders(token) {
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    if (INSTITUTE_ID) h['clientId'] = INSTITUTE_ID;
    return h;
}

function fail(step, res) {
    stepFailures.add(1, { step });
    console.error(`VU${__VU} ${step} failed: status=${res ? res.status : 'n/a'} body=${res ? String(res.body).slice(0, 300) : ''}`);
    journeyFailed.add(1);
}

// Patch the real attempt_data template for this VU + elapsed time so the
// server-side parse (clientLastSync, assessment.timeElapsedInSeconds,
// sections[].questions[].timeTakenInSeconds/responseData) sees live-looking data.
function buildAttemptData(elapsedSecs) {
    let data;
    try {
        data = JSON.parse(attemptTemplate);
    } catch (e) {
        throw new Error('attempt-template.json is not valid JSON — dump a real attempt_data first (RUNBOOK step 4)');
    }
    data.clientLastSync = new Date().toISOString();
    if (data.assessment && typeof data.assessment === 'object') {
        data.assessment.timeElapsedInSeconds = elapsedSecs;
    }
    if (Array.isArray(data.sections)) {
        for (const section of data.sections) {
            if (!Array.isArray(section.questions)) continue;
            for (const q of section.questions) {
                if (typeof q.timeTakenInSeconds === 'number') {
                    q.timeTakenInSeconds = Math.min(elapsedSecs, q.timeTakenInSeconds + Math.floor(Math.random() * 30));
                }
            }
        }
    }
    return JSON.stringify(data);
}

export default function () {
    const username = `${USER_PREFIX}${String(__VU).padStart(4, '0')}`;

    // --- Phase 1: login, jittered across the login window ---
    sleep(Math.random() * LOGIN_WINDOW);

    let res = http.post(`${BASE}/auth-service/learner/v1/login`, JSON.stringify({
        userName: username,
        password: PASSWORD,
        clientName: 'ASSESSMENT',
        instituteId: INSTITUTE_ID,
    }), { headers: jsonHeaders(null), tags: { step: 'login' } });
    loginMs.add(res.timings.duration);
    if (!check(res, { 'login 200': (r) => r.status === 200 })) return fail('login', res);
    const body = res.json();
    const token = body.accessToken || body.access_token || (body.data && body.data.accessToken);
    if (!token) return fail('login-token', res);

    // --- Phase 2: start burst, jittered across the start window ---
    sleep(Math.random() * START_WINDOW);

    const previewUrl = `${BASE}/assessment-service/assessment/learner/assessment-start-preview` +
        `?assessment_id=${ASSESSMENT_ID}&instituteId=${INSTITUTE_ID}` +
        (BATCH_IDS ? `&batch_ids=${BATCH_IDS}` : '');
    res = http.post(previewUrl, JSON.stringify({ username: username }),
        { headers: jsonHeaders(token), tags: { step: 'preview' } });
    previewMs.add(res.timings.duration);
    if (!check(res, { 'preview 200': (r) => r.status === 200 })) return fail('preview', res);
    const preview = res.json();
    const attemptId = preview.attemptId || preview.attempt_id;
    const userRegistrationId = preview.userRegistrationId || preview.user_registration_id || null;
    if (!attemptId) return fail('preview-attemptId', res);

    res = http.post(`${BASE}/assessment-service/assessment/learner/assessment-start-assessment`,
        JSON.stringify({ assessmentId: ASSESSMENT_ID, attemptId: attemptId, userRegistrationId: userRegistrationId }),
        { headers: jsonHeaders(token), tags: { step: 'start' } });
    startMs.add(res.timings.duration);
    if (!check(res, { 'start 200': (r) => r.status === 200 })) return fail('start', res);

    // --- Phase 3: steady-state autosave syncs ---
    const statusBase = `${BASE}/assessment-service/assessment/learner/status`;
    const examStart = Date.now();
    const totalSyncs = Math.max(1, Math.floor((EXAM_MINUTES * 60) / SYNC_INTERVAL));
    for (let i = 0; i < totalSyncs; i++) {
        sleep(SYNC_INTERVAL * (0.9 + Math.random() * 0.2));
        const elapsed = Math.floor((Date.now() - examStart) / 1000);
        res = http.post(`${statusBase}/update?assessmentId=${ASSESSMENT_ID}&attemptId=${attemptId}`,
            JSON.stringify({ jsonContent: buildAttemptData(elapsed) }),
            { headers: jsonHeaders(token), tags: { step: 'sync' } });
        syncMs.add(res.timings.duration);
        check(res, { 'sync 200': (r) => r.status === 200 }) || stepFailures.add(1, { step: 'sync' });
    }

    // --- Phase 4: submit ---
    const elapsed = Math.floor((Date.now() - examStart) / 1000);
    res = http.post(`${statusBase}/submit?assessmentId=${ASSESSMENT_ID}&attemptId=${attemptId}`,
        JSON.stringify({ jsonContent: buildAttemptData(elapsed) }),
        { headers: jsonHeaders(token), tags: { step: 'submit' } });
    submitMs.add(res.timings.duration);
    if (!check(res, { 'submit 200': (r) => r.status === 200 })) return fail('submit', res);

    journeyFailed.add(0);
}

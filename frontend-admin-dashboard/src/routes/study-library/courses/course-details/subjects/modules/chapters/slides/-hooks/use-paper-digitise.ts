import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
    getPaperDigitiseJob,
    isInsufficientCreditsError,
    paperDigitiseErrorMessage,
    startPaperDigitise,
    type DigitisedPaper,
} from '@/services/paper-digitise';

const POLL_MS = 3000;
/** ~1 min of unbroken polling failures before the wait is called off. */
const MAX_POLL_ERRORS = 20;
/** MathPix + extraction on a long paper; beyond this we stop waiting, not the job. */
const MAX_WAIT_MS = 12 * 60 * 1000;

export type DigitiseState =
    | { phase: 'idle' }
    | { phase: 'running'; taskId: string; startedAt: number }
    | { phase: 'review'; paper: DigitisedPaper }
    | { phase: 'failed'; message: string };

/**
 * Read a question-paper PDF into questions (ai_service paper-digitise) and
 * hand the result to a review step. Shared by the slide create form and the
 * "Enable AI checking" retrofit on an existing test, so the guards live once:
 *
 *  - `starting` covers the window before the job exists — a double-click there
 *    would start, and charge, two reads;
 *  - the poll is tied to the job it was started for and stops the moment the
 *    caller abandons it (skip, close, retry), so a result that lands late can
 *    never reopen the review over something already done another way;
 *  - nothing touches state after unmount.
 */
export const usePaperDigitise = () => {
    const { t } = useTranslation('studyLibraryAssessmentCreateForm');
    const queryClient = useQueryClient();
    const [state, setState] = useState<DigitiseState>({ phase: 'idle' });
    const [starting, setStarting] = useState(false);
    const alive = useRef(true);
    const activeTaskRef = useRef<string | null>(null);

    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);

    const poll = useCallback(
        (taskId: string, startedAt: number) => {
            let errors = 0;
            const stillWanted = () => alive.current && activeTaskRef.current === taskId;
            const tick = async () => {
                if (!stillWanted()) return;
                if (Date.now() - startedAt > MAX_WAIT_MS) {
                    activeTaskRef.current = null;
                    setState({ phase: 'failed', message: t('aiCheck.tookTooLong') });
                    return;
                }
                try {
                    const job = await getPaperDigitiseJob(taskId);
                    if (!stillWanted()) return;
                    errors = 0;
                    if (job.status === 'COMPLETED' && job.result) {
                        activeTaskRef.current = null;
                        queryClient.invalidateQueries({ queryKey: ['GET_AI_CREDITS'] });
                        if (job.result.questions.length === 0) {
                            setState({ phase: 'failed', message: t('aiCheck.noQuestions') });
                        } else {
                            setState({ phase: 'review', paper: job.result });
                        }
                        return;
                    }
                    if (job.status === 'FAILED') {
                        activeTaskRef.current = null;
                        setState({
                            phase: 'failed',
                            message: job.status_message || t('aiCheck.readFailed'),
                        });
                        return;
                    }
                } catch (error: unknown) {
                    if (!stillWanted()) return;
                    errors += 1;
                    if (errors >= MAX_POLL_ERRORS) {
                        activeTaskRef.current = null;
                        setState({
                            phase: 'failed',
                            message: paperDigitiseErrorMessage(error, t('aiCheck.lostContact')),
                        });
                        return;
                    }
                }
                setTimeout(tick, POLL_MS);
            };
            setTimeout(tick, POLL_MS);
        },
        [queryClient, t]
    );

    /** Kick off a read. Resolves once the job exists (or has failed to start). */
    const start = useCallback(
        async (input: { pdfUrl: string; expectedTotalMarks?: number; title?: string }) => {
            if (starting) return;
            setStarting(true);
            try {
                const started = await startPaperDigitise(input);
                if (!alive.current) return;
                activeTaskRef.current = started.task_id;
                setState({ phase: 'running', taskId: started.task_id, startedAt: Date.now() });
                poll(started.task_id, Date.now());
            } catch (error: unknown) {
                if (!alive.current) return;
                const message = isInsufficientCreditsError(error)
                    ? paperDigitiseErrorMessage(error, t('aiCheck.insufficientCredits'))
                    : paperDigitiseErrorMessage(error, t('aiCheck.startFailed'));
                setState({ phase: 'failed', message });
            } finally {
                if (alive.current) setStarting(false);
            }
        },
        [poll, starting, t]
    );

    /** Stop waiting for whatever is running and go back to idle. */
    const abandon = useCallback(() => {
        activeTaskRef.current = null;
        setState({ phase: 'idle' });
    }, []);

    return { state, starting, start, abandon };
};

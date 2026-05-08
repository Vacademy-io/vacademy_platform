import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import Joyride, { ACTIONS, EVENTS, STATUS, type CallBackProps, type Step } from 'react-joyride';
import { VIM_TOURS } from './steps';
import { clearTourSeen, isTourSeen, markTourSeen, type VimTourId } from './storage';

interface VimTourContextValue {
    /** Start a tour, even if it has been seen before. */
    startTour: (tourId: VimTourId) => void;
    /** Start a tour only if it has not been completed yet (no-op otherwise). */
    startTourIfNew: (tourId: VimTourId) => void;
    /** True if the corresponding tour has been completed. */
    hasSeen: (tourId: VimTourId) => boolean;
    /** Currently running tour id, or null. */
    activeTour: VimTourId | null;
}

const VimTourContext = createContext<VimTourContextValue | null>(null);

export function useVimTour(): VimTourContextValue {
    const ctx = useContext(VimTourContext);
    if (!ctx) {
        throw new Error('useVimTour must be used within <VimTourProvider />');
    }
    return ctx;
}

interface VimTourProviderProps {
    instituteId: string | undefined;
    children: ReactNode;
}

/**
 * Mounts a single Joyride instance for the vim shell. Tours are run by id —
 * each tour stores its "seen" flag in localStorage scoped to the institute,
 * so users see each tour once and can replay any of them on demand from the
 * help menu.
 *
 * We re-render Joyride with `key={activeTour}` on each tour change so the
 * driver fully resets between tours instead of trying to splice steps.
 */
export function VimTourProvider({ instituteId, children }: VimTourProviderProps) {
    const [activeTour, setActiveTour] = useState<VimTourId | null>(null);
    const [run, setRun] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    // Joyride caches the steps array; setting them right before run avoids a
    // race where the first step targets an anchor that hasn't mounted yet.
    const [steps, setSteps] = useState<Step[]>([]);
    const startTimerRef = useRef<number | null>(null);

    const hasSeen = useCallback(
        (tourId: VimTourId) => isTourSeen(tourId, instituteId),
        [instituteId]
    );

    const startTour = useCallback(
        (tourId: VimTourId) => {
            // Clear the seen flag so a manual replay always runs in full.
            clearTourSeen(tourId, instituteId);
            setSteps(VIM_TOURS[tourId]);
            setStepIndex(0);
            setActiveTour(tourId);
            // Defer one tick so anchor elements that depend on the same state
            // change (e.g. tab switch + tour start in the same handler) are
            // mounted before Joyride does its first measure.
            if (startTimerRef.current) window.clearTimeout(startTimerRef.current);
            startTimerRef.current = window.setTimeout(() => setRun(true), 250);
        },
        [instituteId]
    );

    const startTourIfNew = useCallback(
        (tourId: VimTourId) => {
            if (isTourSeen(tourId, instituteId)) return;
            startTour(tourId);
        },
        [instituteId, startTour]
    );

    const handleCallback = useCallback(
        (data: CallBackProps) => {
            const { status, action, type, index } = data;
            const finished: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

            if (finished.includes(status)) {
                if (activeTour) markTourSeen(activeTour, instituteId);
                setRun(false);
                setActiveTour(null);
                setStepIndex(0);
                return;
            }

            if (action === ACTIONS.CLOSE) {
                if (activeTour) markTourSeen(activeTour, instituteId);
                setRun(false);
                setActiveTour(null);
                setStepIndex(0);
                return;
            }

            // Joyride asks us to drive step changes when controlled.
            if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
                const next = index + (action === ACTIONS.PREV ? -1 : 1);
                setStepIndex(next);
            }
        },
        [activeTour, instituteId]
    );

    useEffect(
        () => () => {
            if (startTimerRef.current) window.clearTimeout(startTimerRef.current);
        },
        []
    );

    const value = useMemo<VimTourContextValue>(
        () => ({ startTour, startTourIfNew, hasSeen, activeTour }),
        [startTour, startTourIfNew, hasSeen, activeTour]
    );

    return (
        <VimTourContext.Provider value={value}>
            {children}
            <Joyride
                key={activeTour ?? 'idle'}
                steps={steps}
                run={run}
                stepIndex={stepIndex}
                continuous
                showProgress
                showSkipButton
                disableOverlayClose
                disableCloseOnEsc={false}
                spotlightPadding={6}
                callback={handleCallback}
                styles={{
                    options: {
                        primaryColor: '#171717', // matches sidebar active bg
                        textColor: '#171717',
                        backgroundColor: '#ffffff',
                        arrowColor: '#ffffff',
                        overlayColor: 'rgba(15, 15, 15, 0.55)',
                        zIndex: 10000,
                    },
                    tooltip: {
                        borderRadius: 12,
                        padding: 16,
                        fontSize: 13,
                    },
                    tooltipTitle: {
                        fontSize: 14,
                        fontWeight: 600,
                        marginBottom: 4,
                    },
                    tooltipContent: {
                        padding: 0,
                        lineHeight: 1.5,
                    },
                    buttonNext: {
                        backgroundColor: '#171717',
                        borderRadius: 6,
                        fontSize: 12,
                        padding: '6px 12px',
                    },
                    buttonBack: {
                        color: '#525252',
                        fontSize: 12,
                        marginRight: 8,
                    },
                    buttonSkip: {
                        color: '#737373',
                        fontSize: 12,
                    },
                }}
                locale={{
                    back: 'Back',
                    close: 'Close',
                    last: 'Done',
                    next: 'Next',
                    skip: 'Skip tour',
                }}
            />
        </VimTourContext.Provider>
    );
}

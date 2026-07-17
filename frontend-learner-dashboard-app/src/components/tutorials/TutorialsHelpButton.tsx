import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { CheckCircle, Question } from '@phosphor-icons/react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { getStudentDisplaySettings } from '@/services/student-display-settings';
import { getLearnerTours, type LearnerTour } from '@/lib/tours/tour-registry';
import { runTour } from '@/lib/tours/run-tour';

const VIEWED_TOURS_KEY = 'learner-viewed-tours';

function readViewedTours(): Set<string> {
  try {
    const raw = localStorage.getItem(VIEWED_TOURS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function rememberViewedTour(key: string) {
  try {
    const ids = readViewedTours();
    ids.add(key);
    localStorage.setItem(VIEWED_TOURS_KEY, JSON.stringify([...ids]));
  } catch {
    // best-effort only — the checkmark is a convenience
  }
}

/**
 * "Help & tutorials" entry point in the top navbar. Rendered only when the
 * institute has enabled tutorials in Settings > Student Display. Lists the
 * enabled guided tours; picking one navigates to the relevant screen and
 * starts the intro-style walkthrough.
 */
export const TutorialsHelpButton = ({ className }: { className?: string }) => {
  const [enabledTourKeys, setEnabledTourKeys] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);
  const [viewed, setViewed] = useState<Set<string>>(() => readViewedTours());
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let cancelled = false;
    getStudentDisplaySettings()
      .then((settings) => {
        if (cancelled) return;
        setEnabledTourKeys(
          settings?.tutorials?.enabled ? settings.tutorials.enabledTours : []
        );
      })
      .catch(() => {
        // Settings unavailable — keep tutorials hidden rather than guessing
        if (!cancelled) setEnabledTourKeys([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tours = useMemo(() => {
    if (!enabledTourKeys || enabledTourKeys.length === 0) return [];
    return getLearnerTours().filter((t) => enabledTourKeys.includes(t.key));
  }, [enabledTourKeys]);

  if (tours.length === 0) return null;

  const startTour = async (tour: LearnerTour) => {
    setOpen(false);
    rememberViewedTour(tour.key);
    setViewed(readViewedTours());
    if (pathname !== tour.route) {
      // Dynamic route strings use the codebase's `as never` pattern
      // (see lib/auth/post-login-redirect.ts)
      await navigate({ to: tour.route as never });
      // Let the target screen mount before highlighting anything on it
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    await runTour(tour);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Help and tutorials"
          data-tour="help-button"
          className={cn(
            // Mirrors the NotificationsBell ghost icon button
            'relative flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-md',
            'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-neutral-700',
            'hover:text-primary-700 dark:hover:text-primary-300 transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            '[.ui-play_&]:rounded-full [.ui-play_&]:bg-primary/10 [.ui-play_&]:border [.ui-play_&]:border-border',
            className
          )}
        >
          <Question className="w-4 h-4 md:w-5 md:h-5" weight="regular" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-screen-85 overflow-y-auto rounded-t-2xl pb-safe"
      >
        <SheetHeader className="text-left">
          <SheetTitle>Tutorials</SheetTitle>
          <SheetDescription>
            Quick guided walkthroughs of the app. Pick one to start.
          </SheetDescription>
        </SheetHeader>
        <ul className="mt-4 flex flex-col gap-2">
          {tours.map((tour) => {
            const Icon = tour.icon;
            const isViewed = viewed.has(tour.key);
            return (
              <li key={tour.key}>
                <button
                  type="button"
                  onClick={() => void startTour(tour)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-left',
                    'transition-colors duration-200 hover:border-primary-300 hover:bg-primary-50/50',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-500">
                    <Icon size={22} weight="duotone" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-body font-semibold text-neutral-700">
                      <span className="truncate">{tour.label}</span>
                      {isViewed && (
                        <CheckCircle
                          size={16}
                          weight="fill"
                          className="shrink-0 text-success-500"
                          aria-label="Viewed"
                        />
                      )}
                    </span>
                    <span className="block truncate text-caption text-neutral-500">
                      {tour.description}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
};

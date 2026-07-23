interface FullScreenLoaderProps {
  /** short human message under the spinner, e.g. "Signing you in…" */
  label?: string;
}

/**
 * Full-screen blocking loader for identity transitions (login, switching into /
 * out of student view) — moments where the app would otherwise show a blank
 * screen while sessions hydrate or a hard reload is prepared. Matches the boot
 * splash in index.html so the transition reads as one continuous loader.
 */
export function FullScreenLoader({ label }: FullScreenLoaderProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background">
      <div className="relative size-14" role="status" aria-live="polite" aria-label={label || "Loading"}>
        <div className="absolute inset-0 rounded-full border-4 border-primary-100" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary-500" />
      </div>
      {label ? <p className="text-body font-medium text-muted-foreground">{label}</p> : null}
    </div>
  );
}

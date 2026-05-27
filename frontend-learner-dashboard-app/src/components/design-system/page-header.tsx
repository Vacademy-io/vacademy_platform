import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned actions (primary button, filters). Wraps below the title on mobile. */
  actions?: React.ReactNode;
  /** Optional slot above the title (back link, breadcrumb). */
  eyebrow?: React.ReactNode;
  className?: string;
}

/**
 * Standard page header: the single page `h1` plus optional description and
 * right-aligned actions. Gives every screen the same title -> content rhythm.
 */
export function PageHeader({ title, description, actions, eyebrow, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        {eyebrow}
        <h1 className="text-h2 font-semibold text-foreground sm:text-h1">{title}</h1>
        {description && <p className="text-body text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export interface SectionShellProps {
  /** Section heading (rendered as h2). Omit for a bare content block. */
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * A titled content section with consistent heading + spacing. Use to compose a
 * page out of clearly separated sections instead of ad-hoc headings.
 */
export function SectionShell({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: SectionShellProps) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            {title && <h2 className="text-title font-semibold text-foreground">{title}</h2>}
            {description && (
              <p className="text-caption text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(contentClassName)}>{children}</div>
    </section>
  );
}

import React from "react";
import { CaretDown, CaretRight, FolderOpen } from "@phosphor-icons/react";

export interface SubjectTile {
  id: string;
  subject_name: string;
  description?: string;
}

interface SubjectTileGridProps {
  subjects: SubjectTile[];
  /** subject id → resolved artwork URL. A subject with no entry shows a glyph. */
  thumbs: Record<string, string>;
  openSubjectId: string | null;
  onToggle: (subjectId: string) => void;
}

/**
 * Subjects as artwork cards — the top level of the "tiles" course-structure
 * variant on the public course page.
 *
 * Purely presentational, and split out of CourseStructureDetails for that
 * reason: that component's subjects arrive from a fetch in an effect, so the
 * grid could not otherwise be rendered in a test. Card shape follows the admin
 * dashboard and the enrolled learner's Content Structure, which is what
 * authors design their subject artwork against.
 */
export const SubjectTileGrid: React.FC<SubjectTileGridProps> = ({
  subjects,
  thumbs,
  openSubjectId,
  onToggle,
}) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {subjects.map((subject) => {
      const isOpen = openSubjectId === subject.id;
      const thumb = thumbs[subject.id];
      return (
        <button
          key={subject.id}
          type="button"
          aria-expanded={isOpen}
          onClick={() => onToggle(subject.id)}
          className={`group overflow-hidden rounded-catalogue-lg border bg-catalogue-bg-elevated text-start transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
            isOpen ? "border-primary-500 shadow-md" : "border-catalogue-border"
          }`}
        >
          <div className="aspect-video w-full overflow-hidden bg-catalogue-bg-subtle">
            {thumb ? (
              <img
                src={thumb}
                alt=""
                loading="lazy"
                className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                onError={(e) => {
                  // A dead media id must not leave a broken-image glyph on a
                  // sales page; the card reads fine as text alone.
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="flex size-full items-center justify-center">
                <FolderOpen size={28} className="text-catalogue-text-muted" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-catalogue-text-primary">
                {subject.subject_name}
              </div>
              {subject.description?.trim() ? (
                <div className="truncate text-sm text-catalogue-text-muted">
                  {subject.description}
                </div>
              ) : null}
            </div>
            {isOpen ? (
              <CaretDown size={16} className="shrink-0" />
            ) : (
              <CaretRight size={16} className="shrink-0" />
            )}
          </div>
        </button>
      );
    })}
  </div>
);

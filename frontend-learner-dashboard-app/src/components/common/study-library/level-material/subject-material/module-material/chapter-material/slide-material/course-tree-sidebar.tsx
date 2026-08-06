// Full course tree for the slide sidebar: Subject → Module → Chapter → Slide.
// Replaces the per-chapter flat slides list so the learner can jump to any
// slide anywhere in the course without leaving the viewer.
//
// Design notes:
//   • Lazy-load modules per subject on first expand (cached in component
//     state keyed by subjectId). Lazy-load slides per chapter the same way.
//   • Auto-expand the ancestor chain of the current slide on mount so the
//     learner lands with their current spot visible.
//   • "Default" pass-through: if a level has a single node literally named
//     "default" (case-insensitive), that node is skipped and its children
//     render at the parent level. Siblings disable this — a real "Default"
//     subject alongside others is preserved.
//   • Rows are single-line: slide titles are de-duplicated against their
//     ancestor names (teachers often prefix every slide with the module
//     name, which drowned the part that differs) and truncate with the
//     full title on the `title` attribute for hover/screen readers.

import { useCallback, useEffect, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import {
  BookOpen,
  Exam,
  FileDoc,
  FilePdf,
  Headphones,
  ListChecks,
  PlayCircle,
  Question,
  CheckCircle,
  Lightning,
  File as FileIcon,
  PresentationChart,
  ChatText,
  GraduationCap,
  Stack,
  BookmarkSimple,
} from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { toTitleCase } from "@/lib/utils";
import { getTerminologyPlural } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import {
  fetchModulesWithChapters,
  fetchModulesWithChaptersPublic,
} from "@/services/study-library/getModulesWithChapters";
import { calculateOverallCompletion } from "./chapter-sidebar-slides";
import type {
  ModulesWithChapters,
  Chapter,
} from "@/stores/study-library/use-modules-with-chapters-store";
import { fetchSlidesByChapterId, type Slide } from "@/hooks/study-library/use-slides";
import { getSlideCompletionThreshold } from "@/constants/study-library";
import {
  computeDisplayTitles,
  getSlideMeta,
  getSlideTitle,
} from "./slide-display-utils";

type BreadcrumbSubject = {
  id: string;
  subject_name: string;
  subject_order?: number | null;
};

type Props = {
  courseId: string;
  sessionId: string; // treated as packageSessionId by the modules API
  subjects: BreadcrumbSubject[];
  currentSubjectId: string;
  currentModuleId: string;
  currentChapterId: string;
  currentSlideId: string;
  /** Modules already fetched for the current subject, if available. Avoids
   *  a redundant network round-trip when the learner arrives from the
   *  breadcrumb flow that already populated the modules store. */
  currentSubjectModules?: ModulesWithChapters[] | null;
  onSlideSelect: (args: {
    subjectId: string;
    moduleId: string;
    chapterId: string;
    slideId: string;
  }) => void;
};

/** Backends frequently wrap content in a "Default" placeholder when a
 *  conceptual level isn't really there (e.g. a 2-level module/chapter course
 *  is returned as a Default subject containing real modules). Any such node
 *  should be invisible — the breadcrumb hides the crumb and the tree
 *  pulls its children up one depth. */
const isDefaultName = (name: string | null | undefined): boolean =>
  (name || "").trim().toLowerCase() === "default";

function getSlideIcon(slide: Slide) {
  const type = slide.source_type?.toUpperCase();
  switch (type) {
    case "VIDEO":
    case "HTML_VIDEO":
      return PlayCircle;
    case "DOCUMENT":
      // Guess PDF vs DOC by available fields; fall back to FileDoc.
      if (slide.document_slide?.type?.toLowerCase().includes("pdf")) return FilePdf;
      return FileDoc;
    case "QUESTION":
      return Question;
    case "QUIZ":
      return ListChecks;
    case "ASSESSMENT":
      return Exam;
    case "AUDIO":
      return Headphones;
    case "ASSIGNMENT":
      return ChatText;
    case "JUPYTER":
    case "CODE":
      return Lightning;
    case "PRESENTATION":
      return PresentationChart;
    case "FEEDBACK":
      return BookOpen;
    default:
      return FileIcon;
  }
}

// ── Leaf: a slide row ───────────────────────────────────────────────────────
const SlideRow = ({
  slide,
  isActive,
  depth,
  displayTitle,
  onClick,
}: {
  slide: Slide;
  isActive: boolean;
  depth: number;
  /** De-duplicated title from computeDisplayTitles (ancestor + sibling
   *  prefixes stripped); the full title stays on the `title` attribute. */
  displayTitle: string;
  onClick: () => void;
}) => {
  const Icon = getSlideIcon(slide);
  const title = getSlideTitle(slide);
  const meta = getSlideMeta(slide);
  const isComplete = (slide.percentage_completed ?? 0) >= getSlideCompletionThreshold();
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{ paddingLeft: `${depth * 14 + 12}px` }}
      className={`w-full flex items-center gap-2 pe-3 py-2 text-start text-caption border-s-2 transition-colors ${
        isActive
          ? "border-primary-500 bg-primary-50 text-primary-700 font-semibold"
          : "border-transparent text-gray-700 hover:bg-gray-50"
      }`}
    >
      <Icon
        className={`w-4 h-4 flex-shrink-0 ${
          isActive ? "text-primary-600" : "text-gray-400"
        }`}
        weight={isActive ? "fill" : "regular"}
      />
      <span className="min-w-0 flex-1 truncate leading-tight">{displayTitle}</span>
      {meta && !isActive && (
        <span className="text-3xs text-gray-400 tabular-nums flex-shrink-0">
          {meta}
        </span>
      )}
      {isComplete && !isActive && (
        <CheckCircle
          className="w-3.5 h-3.5 text-success-500 flex-shrink-0"
          weight="fill"
        />
      )}
      {isActive && (
        <span className="text-3xs font-bold text-primary-500 uppercase tracking-wide flex-shrink-0">
          Now
        </span>
      )}
    </button>
  );
};

// ── Expandable row (subject/module/chapter) ─────────────────────────────────
// Each level gets a distinct icon so the learner can tell the hierarchy apart
// at a glance without reading indentation: a grad-cap for subjects, stacked
// layers for modules, and a bookmark for chapters.
const KIND_ICON: Record<"subject" | "module" | "chapter", PhosphorIcon> = {
  subject: GraduationCap,
  module: Stack,
  chapter: BookmarkSimple,
};

const ExpanderRow = ({
  label,
  kind,
  depth,
  isOpen,
  isOnCurrentPath,
  loading,
  subLabel,
  subLabelTitle,
  onToggle,
}: {
  label: string;
  kind: "subject" | "module" | "chapter";
  depth: number;
  isOpen: boolean;
  isOnCurrentPath: boolean;
  loading?: boolean;
  /** Compact count shown as a right-aligned chip (e.g. "0/8"). */
  subLabel?: string;
  /** Hover/screen-reader expansion of the chip (e.g. "0 of 8 Slides completed"). */
  subLabelTitle?: string;
  onToggle: () => void;
}) => {
  const weightClass =
    kind === "subject"
      ? "font-semibold text-caption"
      : kind === "module"
      ? "font-medium text-caption"
      : "font-medium text-2xs";
  const KindIcon = KIND_ICON[kind];

  // Sticky stacking — each level pins below the one above it while its
  // subtree is scrolled through, so the learner always sees the path they're
  // in without scrolling back up.
  //
  // Offset is driven by `depth` (the actual rendered depth) rather than
  // `kind`, because "Default" placeholder levels are skipped and their
  // children render one level up. Pinning by kind left a gap at the top
  // whenever the subject (or module) was a hidden Default.
  const stickyClasses =
    depth === 0
      ? "sticky top-0 z-30"
      : depth === 1
      ? "sticky top-10 z-20"
      : "sticky top-20 z-10";
  const bgClass = isOnCurrentPath
    ? "bg-primary-50"
    : "bg-white hover:bg-gray-50";

  return (
    <button
      type="button"
      onClick={onToggle}
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
      className={`w-full flex items-center gap-1.5 pe-3 py-2 text-start transition-colors ${stickyClasses} ${bgClass}`}
      title={label}
      aria-expanded={isOpen}
    >
      {isOpen ? (
        <ChevronDownIcon
          className={`w-3 h-3 flex-shrink-0 ${
            isOnCurrentPath ? "text-primary-500" : "text-gray-400"
          }`}
        />
      ) : (
        <ChevronRightIcon
          className={`w-3 h-3 flex-shrink-0 ${
            isOnCurrentPath ? "text-primary-500" : "text-gray-400"
          }`}
        />
      )}
      <KindIcon
        className={`w-3.5 h-3.5 flex-shrink-0 ${
          isOnCurrentPath ? "text-primary-500" : "text-gray-400"
        }`}
        weight={isOnCurrentPath ? "fill" : "regular"}
      />
      <span
        className={`${weightClass} min-w-0 flex-1 truncate leading-tight ${
          isOnCurrentPath ? "text-primary-700" : "text-gray-800"
        }`}
      >
        {toTitleCase(label)}
      </span>
      {loading && (
        <div className="w-3 h-3 border-2 border-primary-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
      )}
      {subLabel && !loading && (
        <span
          title={subLabelTitle}
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-3xs font-semibold tabular-nums ${
            isOnCurrentPath
              ? "bg-white text-primary-600"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {subLabel}
        </span>
      )}
    </button>
  );
};

// `courseId` stays in Props for call-site clarity but isn't needed here —
// the modules/slides APIs key off subject, session and chapter ids alone.
export const CourseTreeSidebar = ({
  sessionId,
  subjects,
  currentSubjectId,
  currentModuleId,
  currentChapterId,
  currentSlideId,
  currentSubjectModules,
  onSlideSelect,
}: Props) => {
  // Expansion state — Sets keyed by the node's full path (subjectId /
  // subjectId:moduleId / subjectId:moduleId:chapterId) rather than the
  // bare id, so a module or chapter that appears in multiple subjects
  // toggles independently per subject. Backends sometimes reuse module
  // or chapter ids across subjects; keying by id alone caused state bleed.
  const moduleKey = (subjectId: string, moduleId: string) =>
    `${subjectId}::${moduleId}`;
  const chapterKey = (subjectId: string, moduleId: string, chapterId: string) =>
    `${subjectId}::${moduleId}::${chapterId}`;
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(
    () => new Set(currentSubjectId ? [currentSubjectId] : [])
  );
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    () =>
      new Set(
        currentSubjectId && currentModuleId
          ? [moduleKey(currentSubjectId, currentModuleId)]
          : []
      )
  );
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    () =>
      new Set(
        currentSubjectId && currentModuleId && currentChapterId
          ? [chapterKey(currentSubjectId, currentModuleId, currentChapterId)]
          : []
      )
  );

  // Caches — populated on first expand, then reused on subsequent toggles.
  const [subjectModulesMap, setSubjectModulesMap] = useState<
    Record<string, ModulesWithChapters[]>
  >(() =>
    currentSubjectId && currentSubjectModules
      ? { [currentSubjectId]: currentSubjectModules }
      : {}
  );
  const [chapterSlidesMap, setChapterSlidesMap] = useState<
    Record<string, Slide[]>
  >({});

  // Loading flags so the expander chevron can show a spinner while fetching.
  const [loadingSubjects, setLoadingSubjects] = useState<Set<string>>(new Set());
  const [loadingChapters, setLoadingChapters] = useState<Set<string>>(new Set());

  const loadSubjectModules = useCallback(
    async (subjectId: string) => {
      if (!subjectId || subjectModulesMap[subjectId]) return;
      setLoadingSubjects((prev) => new Set(prev).add(subjectId));
      try {
        let modules: ModulesWithChapters[] = [];
        try {
          modules = await fetchModulesWithChapters(subjectId, sessionId || "");
        } catch {
          modules = await fetchModulesWithChaptersPublic(subjectId, sessionId || "");
        }
        setSubjectModulesMap((prev) => ({ ...prev, [subjectId]: modules || [] }));
      } catch {
        toast.error("Couldn't load modules for that subject.");
      } finally {
        setLoadingSubjects((prev) => {
          const next = new Set(prev);
          next.delete(subjectId);
          return next;
        });
      }
    },
    [sessionId, subjectModulesMap]
  );

  const loadChapterSlides = useCallback(
    async (chapterId: string) => {
      if (!chapterId || chapterSlidesMap[chapterId]) return;
      setLoadingChapters((prev) => new Set(prev).add(chapterId));
      try {
        const slides = await fetchSlidesByChapterId(chapterId);
        setChapterSlidesMap((prev) => ({ ...prev, [chapterId]: slides || [] }));
      } catch {
        toast.error("Couldn't load slides for that chapter.");
      } finally {
        setLoadingChapters((prev) => {
          const next = new Set(prev);
          next.delete(chapterId);
          return next;
        });
      }
    },
    [chapterSlidesMap]
  );

  // Auto-expand the current path on mount (and whenever IDs change due to
  // in-tree navigation). This is what gives the learner a "you are here"
  // without any manual clicks.
  useEffect(() => {
    if (currentSubjectId) {
      setExpandedSubjects((prev) => {
        if (prev.has(currentSubjectId)) return prev;
        const next = new Set(prev);
        next.add(currentSubjectId);
        return next;
      });
      loadSubjectModules(currentSubjectId);
    }
    if (currentSubjectId && currentModuleId) {
      const key = moduleKey(currentSubjectId, currentModuleId);
      setExpandedModules((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    }
    if (currentSubjectId && currentModuleId && currentChapterId) {
      const key = chapterKey(
        currentSubjectId,
        currentModuleId,
        currentChapterId
      );
      setExpandedChapters((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      loadChapterSlides(currentChapterId);
    }
  }, [
    currentSubjectId,
    currentModuleId,
    currentChapterId,
    loadSubjectModules,
    loadChapterSlides,
  ]);

  const toggleSubject = useCallback(
    (subjectId: string) => {
      setExpandedSubjects((prev) => {
        const next = new Set(prev);
        if (next.has(subjectId)) next.delete(subjectId);
        else {
          next.add(subjectId);
          loadSubjectModules(subjectId);
        }
        return next;
      });
    },
    [loadSubjectModules]
  );

  const toggleModule = useCallback((subjectId: string, moduleId: string) => {
    const key = moduleKey(subjectId, moduleId);
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleChapter = useCallback(
    (subjectId: string, moduleId: string, chapterId: string) => {
      const key = chapterKey(subjectId, moduleId, chapterId);
      setExpandedChapters((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else {
          next.add(key);
          loadChapterSlides(chapterId);
        }
        return next;
      });
    },
    [loadChapterSlides]
  );

  // Auto-load children of any "Default"-named subject so its modules appear
  // immediately even though the subject row itself is hidden.
  useEffect(() => {
    for (const s of subjects) {
      if (isDefaultName(s.subject_name)) {
        loadSubjectModules(s.id);
      }
    }
  }, [subjects, loadSubjectModules]);

  // Same idea for any "Default"-named chapter — load its slides up-front so
  // they render in place of the hidden chapter row.
  useEffect(() => {
    for (const subjectId of Object.keys(subjectModulesMap)) {
      for (const modData of subjectModulesMap[subjectId] || []) {
        for (const chapter of modData.chapters || []) {
          if (isDefaultName(chapter.chapter_name)) {
            loadChapterSlides(chapter.id);
          }
        }
      }
    }
  }, [subjectModulesMap, loadChapterSlides]);

  const renderChapter = useCallback(
    (
      subjectId: string,
      moduleId: string,
      chapter: Chapter,
      depth: number,
      ancestorNames: string[]
    ) => {
      const slides = chapterSlidesMap[chapter.id];
      const isLoading = loadingChapters.has(chapter.id);

      // "Default" chapter is a placeholder for "no chapter level here" —
      // hide the chapter row and render its slides at this depth instead.
      if (isDefaultName(chapter.chapter_name)) {
        return (
          <SkippedChapterSlides
            key={`${subjectId}::${moduleId}::${chapter.id}`}
            chapterId={chapter.id}
            depth={depth}
            moduleId={moduleId}
            subjectId={subjectId}
            currentSlideId={currentSlideId}
            slides={slides}
            isLoading={isLoading}
            ancestorNames={ancestorNames}
            ensureLoaded={() => loadChapterSlides(chapter.id)}
            onSlideSelect={onSlideSelect}
          />
        );
      }

      const isOnPath =
        chapter.id === currentChapterId &&
        moduleId === currentModuleId &&
        subjectId === currentSubjectId;
      const isOpen = expandedChapters.has(
        chapterKey(subjectId, moduleId, chapter.id)
      );

      // Chip: "done/total". Before the slides are fetched, fall back to the
      // per-type counts the chapter object already carries so collapsed
      // chapters still show their size.
      const slidesTerm = getTerminologyPlural(
        ContentTerms.Slides,
        SystemTerms.Slides
      );
      const doneCount = slides
        ? slides.filter(
            (s) =>
              (s.percentage_completed ?? 0) >= getSlideCompletionThreshold()
          ).length
        : null;
      const fallbackTotal =
        (chapter.video_count ?? 0) +
        (chapter.pdf_count ?? 0) +
        (chapter.doc_count ?? 0) +
        (chapter.question_slide_count ?? 0) +
        (chapter.assignment_slide_count ?? 0) +
        (chapter.unknown_count ?? 0);
      const chip =
        slides && slides.length > 0
          ? {
              label: `${doneCount}/${slides.length}`,
              title: `${doneCount} of ${slides.length} ${slidesTerm} completed`,
            }
          : !slides && fallbackTotal > 0
          ? { label: `${fallbackTotal}`, title: `${fallbackTotal} ${slidesTerm}` }
          : undefined;

      return (
        <div key={`${subjectId}::${moduleId}::${chapter.id}`}>
          <ExpanderRow
            kind="chapter"
            label={chapter.chapter_name}
            depth={depth}
            isOpen={isOpen}
            isOnCurrentPath={isOnPath}
            loading={isLoading}
            subLabel={chip?.label}
            subLabelTitle={chip?.title}
            onToggle={() => toggleChapter(subjectId, moduleId, chapter.id)}
          />
          {isOpen && slides && slides.length > 0 && (() => {
            const displayTitles = computeDisplayTitles(slides, [
              ...ancestorNames,
              chapter.chapter_name,
            ]);
            return (
              <div className="relative">
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-0 top-0 w-px bg-gray-100"
                  style={{ insetInlineStart: `${depth * 14 + 14}px` }}
                />
                {/* Progress lives with the chapter it describes (the old
                    detached "Chapter progress" footer duplicated the chip).
                    Hairline-thin so an empty 0% track reads as a rule, not
                    a mystery pill. */}
                {isOnPath && (
                  <div
                    className="pb-1.5 pe-3 pt-0.5"
                    style={{ paddingLeft: `${(depth + 1) * 14 + 12}px` }}
                  >
                    <div className="h-0.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-primary-500 transition-all duration-500 ease-out"
                        style={{
                          width: `${Math.min(calculateOverallCompletion(slides), 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                {slides
                  .filter((s) => s.id !== "feedback-slide")
                  .map((slide) => (
                    <SlideRow
                      key={slide.id}
                      slide={slide}
                      depth={depth + 1}
                      isActive={slide.id === currentSlideId}
                      displayTitle={
                        displayTitles.get(slide.id) ?? getSlideTitle(slide)
                      }
                      onClick={() =>
                        onSlideSelect({
                          subjectId,
                          moduleId,
                          chapterId: chapter.id,
                          slideId: slide.id,
                        })
                      }
                    />
                  ))}
              </div>
            );
          })()}
          {isOpen && slides && slides.length === 0 && !isLoading && (
            <div
              className="text-2xs text-gray-400 italic py-1.5"
              style={{ paddingLeft: `${(depth + 1) * 14 + 12}px` }}
            >
              No {slidesTerm}
            </div>
          )}
        </div>
      );
    },
    [
      expandedChapters,
      chapterSlidesMap,
      loadingChapters,
      currentSubjectId,
      currentModuleId,
      currentChapterId,
      currentSlideId,
      toggleChapter,
      loadChapterSlides,
      onSlideSelect,
    ]
  );

  const renderModule = useCallback(
    (
      subjectId: string,
      modData: ModulesWithChapters,
      depth: number,
      ancestorNames: string[]
    ) => {
      const moduleId = modData.module.id;
      const chapters = modData.chapters || [];

      // "Default" module is a placeholder for "no module level here" — hide
      // the module row and render its chapters at this depth instead. Chapter
      // rendering will recurse and skip any default-named chapters too.
      if (isDefaultName(modData.module.module_name)) {
        return (
          <div key={`${subjectId}::${moduleId}`}>
            {chapters.map((ch) =>
              renderChapter(subjectId, moduleId, ch, depth, ancestorNames)
            )}
          </div>
        );
      }

      const isOnPath =
        moduleId === currentModuleId && subjectId === currentSubjectId;
      const isOpen = expandedModules.has(moduleKey(subjectId, moduleId));
      const chaptersTerm = getTerminologyPlural(
        ContentTerms.Chapters,
        SystemTerms.Chapters
      );
      const doneChapters = chapters.filter(
        (c) => (c.percentage_completed ?? 0) >= getSlideCompletionThreshold()
      ).length;
      const childAncestors = [...ancestorNames, modData.module.module_name];

      return (
        <div key={`${subjectId}::${moduleId}`}>
          <ExpanderRow
            kind="module"
            label={modData.module.module_name}
            depth={depth}
            isOpen={isOpen}
            isOnCurrentPath={isOnPath}
            subLabel={
              chapters.length > 0
                ? `${doneChapters}/${chapters.length}`
                : undefined
            }
            subLabelTitle={`${doneChapters} of ${chapters.length} ${chaptersTerm} completed`}
            onToggle={() => toggleModule(subjectId, moduleId)}
          />
          {/* No indent guide at this level — one guide beside the slide list
              is orientation; nested guides at every level read as stray
              marks at sidebar width. */}
          {isOpen && chapters.length > 0 && (
            <div>
              {chapters.map((ch) =>
                renderChapter(subjectId, moduleId, ch, depth + 1, childAncestors)
              )}
            </div>
          )}
        </div>
      );
    },
    [
      expandedModules,
      currentSubjectId,
      currentModuleId,
      renderChapter,
      toggleModule,
    ]
  );

  const renderSubject = useCallback(
    (subject: BreadcrumbSubject, depth: number) => {
      const modules = subjectModulesMap[subject.id];
      const loading = loadingSubjects.has(subject.id);

      // "Default" subject is a placeholder for "no subject level here" —
      // hide the subject row and render its modules at this depth instead.
      // Modules are auto-loaded by the effect above so the children appear
      // without requiring a (now-hidden) toggle.
      if (isDefaultName(subject.subject_name)) {
        if (!modules && loading) {
          return (
            <div
              key={subject.id}
              className="text-2xs text-gray-400 italic py-1.5"
              style={{ paddingLeft: `${depth * 14 + 12}px` }}
            >
              Loading…
            </div>
          );
        }
        return (
          <div key={subject.id}>
            {(modules || []).map((m) => renderModule(subject.id, m, depth, []))}
          </div>
        );
      }

      const isOnPath = subject.id === currentSubjectId;
      const isOpen = expandedSubjects.has(subject.id);
      const modulesTerm = getTerminologyPlural(
        ContentTerms.Modules,
        SystemTerms.Modules
      );
      return (
        <div key={subject.id}>
          <ExpanderRow
            kind="subject"
            label={subject.subject_name}
            depth={depth}
            isOpen={isOpen}
            isOnCurrentPath={isOnPath}
            loading={loading}
            // Only while expanded — modules load lazily on expand, so a
            // collapsed-subject chip appeared only for subjects the learner
            // happened to have opened before, which read as inconsistent.
            subLabel={
              isOpen && modules ? `${modules.length} ${modulesTerm}` : undefined
            }
            onToggle={() => toggleSubject(subject.id)}
          />
          {isOpen && modules && modules.length > 0 && (
            <div>
              {modules.map((m) =>
                renderModule(subject.id, m, depth + 1, [subject.subject_name])
              )}
            </div>
          )}
          {isOpen && modules && modules.length === 0 && !loading && (
            <div
              className="text-2xs text-gray-400 italic py-1.5"
              style={{ paddingLeft: `${(depth + 1) * 14 + 12}px` }}
            >
              No {modulesTerm}
            </div>
          )}
        </div>
      );
    },
    [
      expandedSubjects,
      subjectModulesMap,
      loadingSubjects,
      currentSubjectId,
      renderModule,
      toggleSubject,
    ]
  );

  return (
    <div className="w-full" role="tree" aria-label="Course content">
      {subjects.map((s) => renderSubject(s, 0))}
    </div>
  );
};

// Inline helper used when a module has a single "Default" chapter — we want
// the chapter's slides to appear directly beneath the module expander. This
// component triggers the slide fetch lazily on render.
const SkippedChapterSlides = ({
  chapterId,
  depth,
  moduleId,
  subjectId,
  currentSlideId,
  slides,
  isLoading,
  ancestorNames,
  ensureLoaded,
  onSlideSelect,
}: {
  chapterId: string;
  depth: number;
  moduleId: string;
  subjectId: string;
  currentSlideId: string;
  slides: Slide[] | undefined;
  isLoading: boolean;
  ancestorNames: string[];
  ensureLoaded: () => void;
  onSlideSelect: Props["onSlideSelect"];
}) => {
  useEffect(() => {
    if (!slides && !isLoading) ensureLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  if (isLoading) {
    return (
      <div
        className="text-2xs text-gray-400 italic py-1.5"
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
      >
        Loading…
      </div>
    );
  }
  if (!slides || slides.length === 0) {
    return (
      <div
        className="text-2xs text-gray-400 italic py-1.5"
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
      >
        No slides
      </div>
    );
  }
  const displayTitles = computeDisplayTitles(slides, ancestorNames);
  return (
    <div>
      {slides
        .filter((s) => s.id !== "feedback-slide")
        .map((slide) => (
          <SlideRow
            key={slide.id}
            slide={slide}
            depth={depth}
            isActive={slide.id === currentSlideId}
            displayTitle={displayTitles.get(slide.id) ?? getSlideTitle(slide)}
            onClick={() =>
              onSlideSelect({
                subjectId,
                moduleId,
                chapterId,
                slideId: slide.id,
              })
            }
          />
        ))}
    </div>
  );
};

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
//   • Titles use `break-words` + `title` attribute so long slide/chapter
//     names wrap fully and are still accessible to screen readers.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import {
  BookOpen,
  FileDoc,
  FilePdf,
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
import {
  fetchModulesWithChapters,
  fetchModulesWithChaptersPublic,
} from "@/services/study-library/getModulesWithChapters";
import type {
  ModulesWithChapters,
  Chapter,
} from "@/stores/study-library/use-modules-with-chapters-store";
import { fetchSlidesByChapterId, type Slide } from "@/hooks/study-library/use-slides";

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

function getSlideTitle(slide: Slide): string {
  return (
    (slide.source_type === "DOCUMENT" && slide.document_slide?.title) ||
    (slide.source_type === "VIDEO" && slide.video_slide?.title) ||
    slide.title ||
    "Untitled"
  );
}

// ── Leaf: a slide row ───────────────────────────────────────────────────────
const SlideRow = ({
  slide,
  isActive,
  depth,
  onClick,
}: {
  slide: Slide;
  isActive: boolean;
  depth: number;
  onClick: () => void;
}) => {
  const Icon = getSlideIcon(slide);
  const title = getSlideTitle(slide);
  const isComplete = (slide.percentage_completed ?? 0) >= 80;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{ paddingLeft: `${depth * 14 + 12}px` }}
      className={`w-full flex items-start gap-2 pr-3 py-2 text-left text-[12px] transition-colors ${
        isActive
          ? "bg-primary-50 text-primary-700 font-semibold"
          : "text-gray-700 hover:bg-gray-50"
      }`}
    >
      <Icon
        className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
          isActive ? "text-primary-600" : "text-gray-400"
        }`}
        weight={isActive ? "fill" : "regular"}
      />
      <span className="min-w-0 flex-1 break-words leading-tight">{title}</span>
      {isComplete && !isActive && (
        <CheckCircle
          className="w-3.5 h-3.5 text-success-500 flex-shrink-0 mt-0.5"
          weight="fill"
        />
      )}
      {isActive && (
        <span className="text-[9px] font-bold text-primary-500 uppercase tracking-wide flex-shrink-0 mt-0.5">
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
  onToggle,
}: {
  label: string;
  kind: "subject" | "module" | "chapter";
  depth: number;
  isOpen: boolean;
  isOnCurrentPath: boolean;
  loading?: boolean;
  subLabel?: string;
  onToggle: () => void;
}) => {
  const weightClass =
    kind === "subject"
      ? "font-semibold text-[12px]"
      : kind === "module"
      ? "font-medium text-[12px]"
      : "font-medium text-[11.5px]";
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
      className={`w-full flex items-start gap-1.5 pr-3 py-2 text-left transition-colors ${stickyClasses} ${bgClass}`}
      title={label}
      aria-expanded={isOpen}
    >
      {isOpen ? (
        <ChevronDownIcon
          className={`w-3 h-3 flex-shrink-0 mt-1 ${
            isOnCurrentPath ? "text-primary-500" : "text-gray-400"
          }`}
        />
      ) : (
        <ChevronRightIcon
          className={`w-3 h-3 flex-shrink-0 mt-1 ${
            isOnCurrentPath ? "text-primary-500" : "text-gray-400"
          }`}
        />
      )}
      <KindIcon
        className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
          isOnCurrentPath ? "text-primary-500" : "text-gray-400"
        }`}
        weight={isOnCurrentPath ? "fill" : "regular"}
      />
      <div className="min-w-0 flex-1">
        <div
          className={`${weightClass} break-words leading-tight ${
            isOnCurrentPath ? "text-primary-700" : "text-gray-800"
          }`}
        >
          {toTitleCase(label)}
        </div>
        {subLabel && (
          <div className="text-[10px] text-gray-400 mt-0.5">{subLabel}</div>
        )}
      </div>
      {loading && (
        <div className="w-3 h-3 border-2 border-primary-400 border-t-transparent rounded-full animate-spin flex-shrink-0 mt-1" />
      )}
    </button>
  );
};

export const CourseTreeSidebar = ({
  courseId,
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
      depth: number
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

      return (
        <div key={`${subjectId}::${moduleId}::${chapter.id}`}>
          <ExpanderRow
            kind="chapter"
            label={chapter.chapter_name}
            depth={depth}
            isOpen={isOpen}
            isOnCurrentPath={isOnPath}
            loading={isLoading}
            subLabel={
              slides && slides.length > 0
                ? `${slides.filter((s) => (s.percentage_completed ?? 0) >= 80).length}/${slides.length} slides`
                : undefined
            }
            onToggle={() => toggleChapter(subjectId, moduleId, chapter.id)}
          />
          {isOpen && slides && slides.length > 0 && (
            <div>
              {slides
                .filter((s) => s.id !== "feedback-slide")
                .map((slide) => (
                  <SlideRow
                    key={slide.id}
                    slide={slide}
                    depth={depth + 1}
                    isActive={slide.id === currentSlideId}
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
          )}
          {isOpen && slides && slides.length === 0 && !isLoading && (
            <div
              className="text-[11px] text-gray-400 italic py-1.5"
              style={{ paddingLeft: `${(depth + 1) * 14 + 12}px` }}
            >
              No slides
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
    (subjectId: string, modData: ModulesWithChapters, depth: number) => {
      const moduleId = modData.module.id;
      const chapters = modData.chapters || [];

      // "Default" module is a placeholder for "no module level here" — hide
      // the module row and render its chapters at this depth instead. Chapter
      // rendering will recurse and skip any default-named chapters too.
      if (isDefaultName(modData.module.module_name)) {
        return (
          <div key={`${subjectId}::${moduleId}`}>
            {chapters.map((ch) => renderChapter(subjectId, moduleId, ch, depth))}
          </div>
        );
      }

      const isOnPath =
        moduleId === currentModuleId && subjectId === currentSubjectId;
      const isOpen = expandedModules.has(moduleKey(subjectId, moduleId));

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
                ? `${chapters.filter((c) => (c.percentage_completed ?? 0) >= 90).length}/${chapters.length} chapters`
                : undefined
            }
            onToggle={() => toggleModule(subjectId, moduleId)}
          />
          {isOpen &&
            chapters.map((ch) =>
              renderChapter(subjectId, moduleId, ch, depth + 1)
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
              className="text-[11px] text-gray-400 italic py-1.5"
              style={{ paddingLeft: `${depth * 14 + 12}px` }}
            >
              Loading…
            </div>
          );
        }
        return (
          <div key={subject.id}>
            {(modules || []).map((m) => renderModule(subject.id, m, depth))}
          </div>
        );
      }

      const isOnPath = subject.id === currentSubjectId;
      const isOpen = expandedSubjects.has(subject.id);
      return (
        <div key={subject.id}>
          <ExpanderRow
            kind="subject"
            label={subject.subject_name}
            depth={depth}
            isOpen={isOpen}
            isOnCurrentPath={isOnPath}
            loading={loading}
            subLabel={modules ? `${modules.length} modules` : undefined}
            onToggle={() => toggleSubject(subject.id)}
          />
          {isOpen && modules && modules.length > 0 && (
            <div>
              {modules.map((m) => renderModule(subject.id, m, depth + 1))}
            </div>
          )}
          {isOpen && modules && modules.length === 0 && !loading && (
            <div
              className="text-[11px] text-gray-400 italic py-1.5"
              style={{ paddingLeft: `${(depth + 1) * 14 + 12}px` }}
            >
              No modules
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
        className="text-[11px] text-gray-400 italic py-1.5"
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
      >
        Loading…
      </div>
    );
  }
  if (!slides || slides.length === 0) {
    return (
      <div
        className="text-[11px] text-gray-400 italic py-1.5"
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
      >
        No slides
      </div>
    );
  }
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

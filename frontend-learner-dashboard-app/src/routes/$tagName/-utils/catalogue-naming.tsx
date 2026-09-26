import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  getTerminology,
  getTerminologyPlural,
} from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";

/**
 * A catalogue's own words for a course, read straight from its config.
 *
 * Deliberately NOT written into the shared naming-settings store. That store is
 * the institute's, shared by every surface and every catalogue it owns, and
 * seeding it from one catalogue would leak that catalogue's vocabulary across
 * the whole app for the rest of the browser session. This stays a read-only
 * override scoped to the React tree the catalogue renders.
 *
 * Falls through to the institute's terminology for anything the catalogue does
 * not set, so a catalogue with no `naming` block behaves exactly as before.
 */
export interface CatalogueNaming {
  course?: string;
  coursePlural?: string;
}

const CatalogueNamingContext = createContext<CatalogueNaming | undefined>(undefined);

export const CatalogueNamingProvider = ({
  naming,
  children,
}: {
  naming: CatalogueNaming | undefined;
  children: ReactNode;
}) => (
  <CatalogueNamingContext.Provider value={naming}>{children}</CatalogueNamingContext.Provider>
);

/** The singular and plural course term for the surface being rendered. */
export const useCourseTerms = (): { course: string; courses: string } => {
  const naming = useContext(CatalogueNamingContext);
  return useMemo(() => {
    const trimmed = (value: string | undefined) =>
      typeof value === "string" && value.trim() ? value.trim() : undefined;
    return {
      course: trimmed(naming?.course) ?? getTerminology(ContentTerms.Course, SystemTerms.Course),
      courses:
        trimmed(naming?.coursePlural) ??
        getTerminologyPlural(ContentTerms.Course, SystemTerms.Course),
    };
  }, [naming?.course, naming?.coursePlural]);
};

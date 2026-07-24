/**
 * Rules for renaming a session/level from the course structure step.
 *
 * These live outside the step component so they can be tested directly, and
 * because the constraints they encode are not cosmetic:
 *
 * - `session` and `level` rows are institute-wide. They carry no institute or
 *   package column and are joined to a course only through `package_session`,
 *   so renaming one from inside a course changes it for every course sharing it.
 * - The backend resolves both by name (findLatestLevelByNameAndInstitute /
 *   findLatestSessionByNameAndInstitute), so two ACTIVE rows sharing a name make
 *   that lookup ambiguous, and the "existing" pickers dedupe by name and hide one.
 * - Rows named "default" are treated as the shared placeholder and are filtered
 *   out of the session cards and instructor-mapping options.
 *
 * Types are structural on purpose: the step component's Session/Level/ExistingBatch
 * satisfy them without this module importing from it (which would be circular).
 */

/** Sessions/levels named this are treated as the shared placeholder row. */
export const RESERVED_DEFAULT_NAME = 'default';

/** Id of the placeholder session used when a course has levels but no sessions. */
export const DEFAULT_SESSION_ID = 'DEFAULT';

const DELETED_STATUS = 'DELETED';

/** How many sharing courses to name before collapsing the rest into a count. */
const MAX_NAMED_COURSES = 3;

export type RenameRowType = 'session' | 'level';

export interface RenamableLevel {
    id: string;
    name: string;
    batchId: string;
}

export interface RenamableSession {
    id: string;
    name: string;
    batchId?: string;
    levels: RenamableLevel[];
}

export interface RenameBatch {
    id: string;
    status?: string;
    level: { id: string; level_name: string };
    session: { id: string; session_name: string };
    package_dto?: { id?: string; package_name?: string };
}

/**
 * Identity of a session card. Two cards can share `session.id` — adding existing
 * batches appends a second object for the same session — so `batchId` is what
 * distinguishes them, matching how removeSession already keys them.
 */
export const sessionKeyOf = (session: Pick<RenamableSession, 'id' | 'batchId'>): string =>
    (session.batchId || session.id).toString();

const isSameName = (a: string, b: string): boolean =>
    a.trim().toLowerCase() === b.trim().toLowerCase();

const liveBatches = (batches: RenameBatch[]): RenameBatch[] =>
    batches.filter((batch) => batch.status !== DELETED_STATUS);

const rowIdOf = (batch: RenameBatch, rowType: RenameRowType): string =>
    rowType === 'session' ? batch.session.id : batch.level.id;

const rowNameOf = (batch: RenameBatch, rowType: RenameRowType): string =>
    rowType === 'session' ? batch.session.session_name : batch.level.level_name;

/**
 * Courses other than `courseId` whose batches use this session/level row.
 * A row id that matches nothing (a not-yet-saved session/level) returns [].
 */
export const getOtherCoursesUsingRow = (
    batches: RenameBatch[],
    courseId: string | undefined,
    rowType: RenameRowType,
    rowId: string | undefined
): string[] => {
    if (!rowId) return [];
    const coursesById = new Map<string, string>();
    liveBatches(batches).forEach((batch) => {
        if (rowIdOf(batch, rowType) !== rowId) return;
        const pkg = batch.package_dto;
        if (!pkg?.id || pkg.id === courseId) return;
        coursesById.set(pkg.id, pkg.package_name || 'Untitled');
    });
    return Array.from(coursesById.values());
};

/** Warns that a rename reaches beyond this course, naming who it affects. */
export const buildRenameShareWarning = (
    batches: RenameBatch[],
    courseId: string | undefined,
    rowType: RenameRowType,
    rowId: string | undefined,
    courseTerm: string
): string | null => {
    const others = getOtherCoursesUsingRow(batches, courseId, rowType, rowId);
    if (others.length === 0) return null;
    const shown = others.slice(0, MAX_NAMED_COURSES).join(', ');
    const rest =
        others.length > MAX_NAMED_COURSES ? ` and ${others.length - MAX_NAMED_COURSES} more` : '';
    const term = courseTerm.toLowerCase();
    return `Shared with ${others.length} other ${term}${
        others.length > 1 ? 's' : ''
    } (${shown}${rest}). Renaming changes it there too.`;
};

/** Whether another institute row of the same type already holds this name. */
export const isNameTakenInInstitute = (
    batches: RenameBatch[],
    rowType: RenameRowType,
    rowId: string | undefined,
    name: string
): boolean =>
    liveBatches(batches).some(
        (batch) => rowIdOf(batch, rowType) !== rowId && isSameName(rowNameOf(batch, rowType), name)
    );

const validateReservedName = (name: string, term: string): string | null => {
    if (!name.trim()) return 'Name is required';
    if (name.trim().toLowerCase() === RESERVED_DEFAULT_NAME) {
        return `"${name}" is a reserved name. Please choose a different ${term.toLowerCase()} name.`;
    }
    return null;
};

/** Returns an error message to block the rename, or null to accept it. */
export const validateSessionRename = ({
    sessions,
    batches,
    courseId,
    sessionKey,
    name,
    term,
}: {
    sessions: RenamableSession[];
    batches: RenameBatch[];
    courseId?: string;
    sessionKey: string;
    name: string;
    term: string;
}): string | null => {
    // The DEFAULT session is a shared placeholder row and must never be renamed.
    if (sessionKey === DEFAULT_SESSION_ID) return `This ${term.toLowerCase()} cannot be renamed.`;
    const reservedError = validateReservedName(name, term);
    if (reservedError) return reservedError;
    // Same-named siblings resolve to one shared row on the backend, minting duplicate batches.
    const isDuplicate = sessions.some(
        (session) => sessionKeyOf(session) !== sessionKey && isSameName(session.name, name)
    );
    if (isDuplicate) return `A ${term.toLowerCase()} with this name already exists.`;
    const rowId = sessions.find((session) => sessionKeyOf(session) === sessionKey)?.id;
    if (isNameTakenInInstitute(batches, 'session', rowId, name)) {
        return `A ${term.toLowerCase()} named "${name.trim()}" already exists in this institute.`;
    }
    return null;
};

/** Returns an error message to block the rename, or null to accept it. */
export const validateLevelRename = ({
    sessions,
    batches,
    courseId,
    sessionKey,
    batchId,
    name,
    term,
}: {
    sessions: RenamableSession[];
    batches: RenameBatch[];
    courseId?: string;
    sessionKey: string;
    batchId: string;
    name: string;
    term: string;
}): string | null => {
    if (!batchId) return `This ${term.toLowerCase()} cannot be renamed.`;
    const reservedError = validateReservedName(name, term);
    if (reservedError) return reservedError;
    const siblings = sessions.find((session) => sessionKeyOf(session) === sessionKey)?.levels ?? [];
    const isDuplicate = siblings.some(
        (level) => level.batchId !== batchId && isSameName(level.name, name)
    );
    if (isDuplicate) return `A ${term.toLowerCase()} with this name already exists here.`;
    const rowId = siblings.find((level) => level.batchId === batchId)?.id;
    if (isNameTakenInInstitute(batches, 'level', rowId, name)) {
        return `A ${term.toLowerCase()} named "${name.trim()}" already exists in this institute.`;
    }
    return null;
};

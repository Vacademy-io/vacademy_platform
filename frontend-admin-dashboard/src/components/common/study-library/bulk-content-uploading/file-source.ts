// Bulk Content Uploading — in-memory file source for the "select files directly"
// CSV flow (no zip). Files picked in the browser are held here; the commit
// pipeline reads them by basename, exactly as it reads zip entries.

import type { ZipEntryMeta } from './conventions';

let directFiles: Map<string, File> | null = null; // key = lowercased basename

const basename = (path: string): string => (path.split('/').pop() ?? path).toLowerCase();

export const setDirectFiles = (files: File[]): void => {
    directFiles = new Map(files.map((f) => [basename(f.name), f]));
};

export const clearDirectFiles = (): void => {
    directFiles = null;
};

export const hasDirectFiles = (): boolean => !!directFiles && directFiles.size > 0;

/** Synthetic zip-style entries so resolveManifest can match by basename uniformly. */
export const directFileEntries = (): ZipEntryMeta[] =>
    directFiles
        ? [...directFiles.values()].map((f) => ({
              path: f.name,
              isDirectory: false,
              uncompressedSize: f.size,
              utf8Name: true,
          }))
        : [];

/** extractFile implementation for the pipeline — returns the in-memory File. */
export const extractDirectFile = (entryPath: string, fileName: string): Promise<File> => {
    const file = directFiles?.get(basename(entryPath || fileName));
    if (!file) {
        return Promise.reject(
            new Error('File is no longer available — re-select your files and retry.')
        );
    }
    return Promise.resolve(file);
};

/** Stable within-session key for the resume manifest (no real fingerprint — files don't persist). */
export const currentDirectFingerprint = (): string =>
    directFiles
        ? [...directFiles.values()]
              .map((f) => `${f.name}:${f.size}`)
              .sort()
              .join('|')
        : '';

export const directTotalBytes = (): number =>
    directFiles ? [...directFiles.values()].reduce((sum, f) => sum + f.size, 0) : 0;

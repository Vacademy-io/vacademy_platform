import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount anything a test rendered. Vitest isolates each test FILE in its own
// environment, so without this the leak is invisible — but within a file (and in
// any shared-process pool mode) a previous test's DOM stays mounted and makes
// queries like getByText ambiguous. Standard RTL + Vitest wiring.
afterEach(() => {
    cleanup();
});

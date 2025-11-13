import type { NavigateFn } from "@tanstack/react-router";

export function navigateByHomeIcon(route: string | null | undefined, navigate?: NavigateFn) {
  if (!route || typeof route !== "string") {
    return;
  }
  const trimmed = route.trim();
  if (!trimmed) {
    return;
  }
  const isExternal = /^https?:\/\//i.test(trimmed);
  if (isExternal) {
    window.location.href = trimmed;
    return;
  }
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (navigate) {
    // TanStack Router navigate
    navigate({ to: path as never });
  } else {
    window.location.href = path;
  }
}



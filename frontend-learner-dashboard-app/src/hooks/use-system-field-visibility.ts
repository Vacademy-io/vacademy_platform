import { useCallback, useEffect, useState } from "react";
import {
  getSystemFieldVisibilityMap,
  type SystemFieldVisibilityMap,
} from "@/services/field-visibility-settings";

/**
 * Loads the institute's system-field visibility config and exposes a checker.
 * `isFieldVisible(key)` is true unless the admin explicitly turned the field off,
 * so it fails open while the config is loading or if it can't be fetched.
 */
export function useSystemFieldVisibility() {
  const [map, setMap] = useState<SystemFieldVisibilityMap>({});

  useEffect(() => {
    let active = true;
    getSystemFieldVisibilityMap().then((result) => {
      if (active) setMap(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const isFieldVisible = useCallback(
    (key: string) => map[key] !== false,
    [map]
  );

  return { isFieldVisible };
}

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { ParentModuleIcon } from "@/components/parent/ParentModuleIcon";
import { MODULE_TILES } from "./module-tiles";
import { cn } from "@/lib/utils";

interface ParentQuickSearchProps {
  childId: string;
  availableKeys: Set<string>;
}

/**
 * Quick-find bar: type a few letters (e.g. "at") and matching sections
 * ("Attendance") appear — tap one to jump straight there. A fast, discoverable
 * way for parents to reach a section without hunting the grid.
 */
export function ParentQuickSearch({ childId, availableKeys }: ParentQuickSearchProps) {
  const { t } = useTranslation("parent");
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const tiles = MODULE_TILES.filter((tile) => availableKeys.has(tile.key));
  const query = q.trim().toLowerCase();
  const matches = query
    ? tiles.filter((tile) => t(tile.labelKey).toLowerCase().includes(query))
    : [];

  const go = (segment: string) => {
    setQ("");
    navigate({ to: `/parent/child/${childId}/${segment}` as never });
  };

  return (
    <div className="relative" data-tour="parent-search">
      <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-sm">
        <MagnifyingGlass className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          className="w-full bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {matches.length > 0 ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl bg-card shadow-lg">
          {matches.map((tile) => (
            <button
              key={tile.key}
              onClick={() => go(tile.segment)}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-start",
                "transition-colors hover:bg-primary-50 focus:outline-none focus-visible:bg-primary-50",
              )}
            >
              <div className="size-7 shrink-0">
                <ParentModuleIcon name={tile.icon} />
              </div>
              <span className="text-body text-foreground">{t(tile.labelKey)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

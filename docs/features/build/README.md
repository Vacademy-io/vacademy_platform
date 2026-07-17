# Feature catalog build pipeline

The two deliverables in the parent folder are **generated from one data source** so they never drift:

```
catalog.json  ──►  build_catalog.py  ──►  ../vacademy-features.md
                        │                 ../vacademy-features.html
explorer-template.html ─┘
```

## How to update the catalog

1. Edit `catalog.json` — it holds the full product taxonomy:
   `pillars[] → features[] → subFeatures[]`. Each feature has `id` (kebab-case,
   unique within its pillar), `name`, `tagline`, `description`, `roles`,
   `platforms`, `subFeatures[{name, description}]`.
2. Bump `meta.updated` in `catalog.json` to today's date, then regenerate:

   ```bash
   python3 build_catalog.py catalog.json explorer-template.html ..
   ```
3. Commit `catalog.json` + the two regenerated files together.

Quick edits directly in `vacademy-features.html` (its embedded `DATA` object)
or in the `.md` also work — but then mirror the change in `catalog.json` so
the next regeneration doesn't lose it.

## Template

`explorer-template.html` is the interactive explorer shell (search, product
cards, deep-dive pages). `build_catalog.py` injects the JSON where the
`__DATA_JSON__` placeholder sits. Change look & feel in the template; change
content in `catalog.json`.

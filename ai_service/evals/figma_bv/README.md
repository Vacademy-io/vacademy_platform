# Brahm Varchas Figma eval

This eval checks `design_import` against a real client design. It turns the Brahm Varchas Figma file into a plan and scores that plan against the site the team built by hand, which is the committed fixture `frontend-admin-dashboard/src/routes/manage-pages/-components/__fixtures__/brahm-varchas-site.json`.

The design files are **client material**. They live only in a private S3 prefix and are **never committed** to this repo. The `.gitignore` in this folder blocks the usual file names, but check `git status` before you commit anyway.

## What is here

| File | What it is |
|---|---|
| `run.py` | Tier-1 runner: it plans the design and prints a scorecard. With `--check` it exits 1 when any threshold fails. |
| `scorers.py` | The scorers: patterns, section order, palette ΔE, fonts, width, data needs, chrome and copy. |
| `expected.json` | Facts the fixture cannot hold: the data the setup needed, the thresholds and the input file names. |
| `../../tests/test_figma_bv_eval.py` | Scorer unit tests, which always run, and the tier-1 thresholds, which skip without the inputs. |

## What goes in the bucket

Put everything under one prefix, for example `s3://<private-bucket>/evals/figma-bv/`:

| Key under the prefix | Source | Used by |
|---|---|---|
| `page1.xml` | Figma `get_metadata` of the design page (all frames) | tier 1, CI |
| `courses.tsx` | `get_design_context` of the Courses frame (node `1:36`) | tier 1, CI |
| `paths.tsx` | `get_design_context` of the Learning Paths frame (node `73:324`) | tier 1, CI |
| `coming_soon.tsx` | `get_design_context` of the Coming Soon frame | tier 2 |
| `megamenu.notes.md` | Notes on the mega-menu frame, which is hover-only and not in the frame dump | tier 2 |
| `assets/` | The exported image assets and `assets/INDEX.tsv` | tier 2 (`import_image`) |
| `fig/c0-5.png`, `fig/p0-6.png`, `fig/m0-1.png` | Frame renders (Courses, Paths, mega menu) for the visual compare | tier 2 (SSIM) |
| `fixture/` (optional) | A pinned copy of the site fixture, plus the mock `data_inventory` sources (`folder_ids.json`, `product_pages_created.json`, `campaign_ids.json`) | tier 2 |

Tier 1, the one CI runs, reads only the three files named in `expected.json` (`metadata` and `design_code`). It always uses the fixture committed in the repo.

## Bucket rules

- **Block all public access** must be on. The upload script refuses a bucket where it cannot confirm this.
- Objects are encrypted at rest: SSE-S3 by default, or SSE-KMS when `FIGMA_BV_KMS_KEY_ID` is set.
- Give CI a **read-only** key scoped to the prefix (`s3:GetObject` on `arn:aws:s3:::<bucket>/evals/figma-bv/*`) rather than the deploy key.
- Delete the prefix if the client withdraws permission. CI then skips again on its own once the secret is removed.

## Upload (maintainers)

```bash
# Dry run first, then for real. AWS credentials come from your normal CLI profile.
scripts/upload-figma-bv-eval-inputs.sh --dry-run s3://<private-bucket>/evals/figma-bv <figma-dir> <renders-dir>
scripts/upload-figma-bv-eval-inputs.sh           s3://<private-bucket>/evals/figma-bv <figma-dir> <renders-dir>
```

- `<figma-dir>` holds `page1.xml`, `courses.tsx`, `paths.tsx`, `coming_soon.tsx`, `megamenu.notes.md` and `assets/`. The whole folder is synced to the prefix.
- `<renders-dir>` holds the `*.png` frame renders. They are synced to `<prefix>/fig/`.

The script refuses the bucket root, missing tier-1 files, and buckets that do not block public access.

## CI

The workflow is `.github/workflows/figma-bv-eval.yml`. It runs on changes to the importer, the eval, the pattern catalog or the fixture, and it can also be started by hand. Set these repository secrets:

| Secret | Required | Meaning |
|---|---|---|
| `FIGMA_BV_S3_URI` | yes, to run | `s3://<private-bucket>/<prefix>` |
| `FIGMA_BV_AWS_ACCESS_KEY` / `FIGMA_BV_AWS_SECRET_KEY` | recommended | A read-only key. Without it the job falls back to `AWS_ACCESS_KEY` / `AWS_SECRET_ACCESS_KEY`. |
| `FIGMA_BV_AWS_REGION` | no | Defaults to `us-east-1` |

Without `FIGMA_BV_S3_URI` the job **skips**. It stays green, leaves a notice, and writes "skipped" in the run summary. This is what happens for forks, Dependabot, and any copy of the repo without the bucket. When the secret is set, the job:

1. downloads the tier-1 files with the AWS credentials, which only that step receives;
2. runs `python -m evals.figma_bv.run --check` with no credentials;
3. writes the pass or fail table to the run summary;
4. deletes the inputs.

No artifact is uploaded, because the scorecard can quote the client's copy.

## Run locally

```bash
cd ai_service
FIGMA_BV_INPUTS=/path/to/inputs python -m evals.figma_bv.run --check
python -m evals.figma_bv.run --s3 s3://<private-bucket>/evals/figma-bv --json /tmp/card.json   # AWS credential chain
FIGMA_BV_INPUTS=/path/to/inputs python -m pytest -q tests/test_figma_bv_eval.py
```

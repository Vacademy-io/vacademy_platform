#!/usr/bin/env python3
"""
pptx-animated-html — convert a .pptx into "build-step" images + a manifest the
DeckPlayer consumes. Each entrance/fade animation becomes a snapshot; the player
cross-fades between snapshots to replay the animation.

Pipeline:
  1. Unzip the .pptx (it's a ZIP of XML).
  2. Read each slide's <p:timing> tree for ENTRANCE animations grouped by click
     (presetClass="entr" only — emphasis/exit are ignored so always-visible
     shapes don't wrongly disappear; shapes revealed together on a single click
     stay in one group, so one click isn't split into several cross-fades).
  3. For a slide with G click-groups, emit G+1 "step" slides, each a copy of the
     slide XML with the not-yet-revealed shapes (and the <p:timing> tree) removed.
  4. Stitch every step slide into one flattened .pptx.
  5. Render that ONCE via LibreOffice -> PDF, then rasterize per page with
     PyMuPDF (fitz) at the requested DPI.
  6. Write manifest.json grouping the images back into original slides.

This is the render_worker-adapted version of the standalone convert.py:
  - rasterizes with PyMuPDF instead of poppler's pdftoppm (already a worker dep),
  - isolates each LibreOffice run with a per-call UserInstallation profile so
    concurrent jobs don't collide,
  - captures soffice stderr and verifies the PDF was produced,
  - adds convert_deck_to_s3() which downloads the source + uploads the artifacts
    via the worker's shared S3Helper.

System requirements (image): libreoffice (headless) — provides `soffice`.
Python requirements: lxml, pymupdf.

Fidelity / limitations:
  - ENTRANCE animations (appear / fade in) are reproduced as cross-fades.
  - MOTION PATHS collapse to a fade (a moving element can't be two stills).
  - EXIT animations are not modelled (the pipeline only reveals, never hides).
  - Per-paragraph text builds collapse into one fade of the whole text box.
  - Group shapes (<p:grpSp>) are not individually revealed.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import tempfile
import uuid
import zipfile
from pathlib import Path

import fitz  # PyMuPDF — already a render_worker dependency
from lxml import etree

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
P = NS["p"]
R = NS["r"]
CT = "http://schemas.openxmlformats.org/package/2006/content-types"
REL = "http://schemas.openxmlformats.org/package/2006/relationships"
SLIDE_CT = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml"

# LibreOffice convert can hang on a malformed deck; cap it.
_SOFFICE_TIMEOUT_S = int(os.environ.get("PPTX_ANIM_SOFFICE_TIMEOUT_S", "600"))


def _read(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


def _write(path: str, data: bytes) -> None:
    with open(path, "wb") as f:
        f.write(data)


def _slide_paths(unzipped):
    slides_dir = Path(unzipped) / "ppt" / "slides"
    paths = [str(p) for p in slides_dir.glob("slide*.xml")]
    # numeric sort by the trailing index (slide2 before slide10)
    return sorted(paths, key=lambda p: int("".join(c for c in Path(p).stem[5:] if c.isdigit()) or "0"))


def _animated_groups(slide_root):
    """Ordered build-step groups of ENTRANCE-animated shape ids.

    Each inner list is the set of shapes revealed by ONE click. Shapes that play
    together on a single click ("with/after previous") stay in the same group, so
    the player reveals them together instead of splitting one click into several
    cross-fades. Only entrance effects (<p:cTn presetClass="entr">) count, so
    always-visible shapes (and emphasis/exit effects) are never hidden.

    Click boundaries are the on-click start conditions (<p:cond delay="indefinite">)
    inside the main sequence; entrance effects before the first click form the
    first group. Returns [] when there are no entrance animations (one step).
    """
    timing = slide_root.find(".//p:timing", NS)
    if timing is None:
        return []

    # Scope to the main (click-driven) sequence. Interactive/triggered sequences
    # don't fit a linear slideshow, so we ignore them (their shapes stay visible).
    scope = timing
    for ctn in timing.iter(f"{{{P}}}cTn"):
        if ctn.get("nodeType") == "mainSeq":
            scope = ctn
            break

    groups, current, seen = [], [], set()
    for ctn in scope.iter(f"{{{P}}}cTn"):
        cond_lst = ctn.find("./p:stCondLst", NS)
        if cond_lst is not None and any(
            c.get("delay") == "indefinite" for c in cond_lst.findall("./p:cond", NS)
        ):
            if current:  # an on-click trigger starts a new build step
                groups.append(current)
                current = []
        if ctn.get("presetClass") == "entr":
            for tgt in ctn.iter(f"{{{P}}}spTgt"):
                sid = tgt.get("spid")
                if sid and sid not in seen:
                    seen.add(sid)
                    current.append(sid)
    if current:
        groups.append(current)
    return groups


def _shape_id(shape):
    nv = shape.find(".//p:cNvPr", NS)
    return nv.get("id") if nv is not None else None


def _strip(slide_xml_bytes, remove_ids):
    """Return slide XML with the given shape ids removed, and <p:timing> dropped.

    Removing timing guarantees the kept (revealed) shapes render visible
    regardless of how a given LibreOffice build treats animation start-states.
    """
    root = etree.fromstring(slide_xml_bytes)
    if remove_ids:
        shapes = (
            root.findall(".//p:sp", NS)
            + root.findall(".//p:pic", NS)
            + root.findall(".//p:graphicFrame", NS)
        )
        for shp in shapes:
            if _shape_id(shp) in remove_ids:
                shp.getparent().remove(shp)
    for timing in root.findall(".//p:timing", NS):
        timing.getparent().remove(timing)
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def _build_plan(unzipped):
    """Return (plan, steps_per_slide).

    plan: list of (orig_index, remove_ids_set), one entry per output page.
    steps_per_slide: list[int], number of pages for each original slide.
    """
    plan, steps_per_slide = [], []
    for i, sp in enumerate(_slide_paths(unzipped)):
        root = etree.parse(sp).getroot()
        groups = _animated_groups(root)
        if not groups:
            plan.append((i, set()))
            steps_per_slide.append(1)
            continue
        # Step k reveals groups[0..k-1]; hide everything in groups[k:].
        for step in range(len(groups) + 1):
            hidden = set()
            for g in groups[step:]:
                hidden.update(g)
            plan.append((i, hidden))
        steps_per_slide.append(len(groups) + 1)
    return plan, steps_per_slide


def _flatten(unzipped, plan, flat_dir, flat_pptx):
    """Write a flattened .pptx where every plan entry is its own slide."""
    if os.path.exists(flat_dir):
        shutil.rmtree(flat_dir)
    shutil.copytree(unzipped, flat_dir)

    slide_paths = _slide_paths(unzipped)
    orig_xml = [_read(p) for p in slide_paths]
    orig_rels = []
    for p in slide_paths:
        rp = f"{unzipped}/ppt/slides/_rels/{os.path.basename(p)}.rels"
        orig_rels.append(_read(rp) if os.path.exists(rp) else None)

    # clear existing slide parts in the copy
    for f in Path(f"{flat_dir}/ppt/slides").glob("slide*.xml"):
        f.unlink()
    rels_dir = Path(f"{flat_dir}/ppt/slides/_rels")
    if rels_dir.exists():
        for f in rels_dir.glob("*.rels"):
            f.unlink()

    ct_over, pres_rels, sld_ids = [], [], []
    for idx, (oi, remove) in enumerate(plan):
        num = idx + 1
        name = f"slide{num}.xml"
        _write(f"{flat_dir}/ppt/slides/{name}", _strip(orig_xml[oi], remove))
        if orig_rels[oi] is not None:
            rels_dir.mkdir(parents=True, exist_ok=True)
            _write(f"{flat_dir}/ppt/slides/_rels/{name}.rels", orig_rels[oi])
        ct_over.append(
            f'<Override PartName="/ppt/slides/{name}" ContentType="{SLIDE_CT}"/>'
        )
        rid = f"rIdFlat{num}"
        pres_rels.append(
            f'<Relationship Id="{rid}" '
            f'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" '
            f'Target="slides/{name}"/>'
        )
        sld_ids.append((num, rid))

    # [Content_Types].xml — swap slide overrides
    ctp = f"{flat_dir}/[Content_Types].xml"
    ct = etree.parse(ctp)
    ctr = ct.getroot()
    for ov in ctr.findall(f"{{{CT}}}Override"):
        if ov.get("ContentType", "").endswith("presentationml.slide+xml"):
            ctr.remove(ov)
    frag = etree.fromstring(f'<r xmlns="{CT}">' + "".join(ct_over) + "</r>")
    for c in frag:
        ctr.append(c)
    ct.write(ctp, xml_declaration=True, encoding="UTF-8", standalone=True)

    # presentation.xml.rels — swap slide relationships (keep master/theme/etc.)
    prp = f"{flat_dir}/ppt/_rels/presentation.xml.rels"
    pr = etree.parse(prp)
    prr = pr.getroot()
    for rel in prr.findall(f"{{{REL}}}Relationship"):
        if rel.get("Type", "").endswith("/slide"):
            prr.remove(rel)
    frag = etree.fromstring(f'<r xmlns="{REL}">' + "".join(pres_rels) + "</r>")
    for c in frag:
        prr.append(c)
    pr.write(prp, xml_declaration=True, encoding="UTF-8", standalone=True)

    # presentation.xml — rebuild sldIdLst (must sit right before sldSz)
    pp = f"{flat_dir}/ppt/presentation.xml"
    pres = etree.parse(pp)
    proot = pres.getroot()
    lst = proot.find("p:sldIdLst", NS)
    if lst is None:
        lst = etree.SubElement(proot, f"{{{P}}}sldIdLst")
    for c in list(lst):
        lst.remove(c)
    sid = 256
    for num, rid in sld_ids:
        e = etree.SubElement(lst, f"{{{P}}}sldId")
        e.set("id", str(sid))
        e.set(f"{{{R}}}id", rid)
        sid += 1
    proot.remove(lst)
    proot.find("p:sldSz", NS).addprevious(lst)
    pres.write(pp, xml_declaration=True, encoding="UTF-8", standalone=True)

    # zip up
    if os.path.exists(flat_pptx):
        os.remove(flat_pptx)
    with zipfile.ZipFile(flat_pptx, "w", zipfile.ZIP_DEFLATED) as zf:
        for rootdir, _, files in os.walk(flat_dir):
            for fn in files:
                full = os.path.join(rootdir, fn)
                zf.write(full, os.path.relpath(full, flat_dir))


def _render(flat_pptx, work, out_images, dpi):
    """LibreOffice -> PDF, then PyMuPDF -> per-page PNG. Returns ordered pages.

    Each soffice run gets its own UserInstallation profile so concurrent jobs
    in the same worker don't attach to one another's instance (the classic
    "second conversion silently produces nothing" headless bug).
    """
    profile = Path(work) / f"lo_{uuid.uuid4().hex}"
    proc = subprocess.run(
        [
            "soffice",
            "--headless",
            f"-env:UserInstallation=file://{profile}",
            "--convert-to",
            "pdf",
            "--outdir",
            work,
            flat_pptx,
        ],
        capture_output=True,
        text=True,
        timeout=_SOFFICE_TIMEOUT_S,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"soffice failed ({proc.returncode}): {proc.stderr[-2000:]}")

    pdf = os.path.join(work, os.path.splitext(os.path.basename(flat_pptx))[0] + ".pdf")
    if not os.path.exists(pdf):
        raise RuntimeError(f"soffice produced no PDF. stderr: {proc.stderr[-2000:]}")

    os.makedirs(out_images, exist_ok=True)
    zoom = dpi / 72.0
    matrix = fitz.Matrix(zoom, zoom)
    pages = []
    doc = fitz.open(pdf)
    try:
        width = max(2, len(str(doc.page_count)))  # zero-pad so names sort lexically
        for i in range(doc.page_count):
            pix = doc.load_page(i).get_pixmap(matrix=matrix, alpha=False)
            name = f"page-{str(i + 1).zfill(width)}.png"
            path = os.path.join(out_images, name)
            pix.save(path)
            pages.append(path)
    finally:
        doc.close()
    return pages


def convert(pptx_path, out_dir, dpi=110, image_subdir="images"):
    """Convert a .pptx into step images + manifest.json under out_dir.

    Returns the manifest dict: {"slides": [[img, ...], ...], "steps_per_slide": [...]}
    where each inner list is one original slide's ordered build-step images.
    """
    out_dir = os.path.abspath(out_dir)
    work = os.path.join(out_dir, "_work")
    unzipped = os.path.join(work, "src")
    flat_dir = os.path.join(work, "flat")
    flat_pptx = os.path.join(work, "flat.pptx")
    img_dir = os.path.join(out_dir, image_subdir)

    if os.path.exists(out_dir):
        shutil.rmtree(out_dir)
    os.makedirs(unzipped)

    with zipfile.ZipFile(pptx_path) as z:
        z.extractall(unzipped)

    plan, steps_per_slide = _build_plan(unzipped)
    _flatten(unzipped, plan, flat_dir, flat_pptx)
    pages = _render(flat_pptx, work, img_dir, dpi)

    if len(pages) != len(plan):
        raise RuntimeError(
            f"page/plan mismatch: {len(pages)} images vs {len(plan)} planned steps"
        )

    # group images back into original slides
    slides, idx = [], 0
    for count in steps_per_slide:
        group = [
            f"{image_subdir}/{os.path.basename(pages[idx + k])}" for k in range(count)
        ]
        slides.append(group)
        idx += count

    manifest = {"slides": slides, "steps_per_slide": steps_per_slide}
    with open(os.path.join(out_dir, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    shutil.rmtree(work)  # drop intermediates
    return manifest


def convert_deck_to_s3(pptx_url, deck_id, dpi=110, progress_cb=None):
    """Worker entry point: download the .pptx, convert, upload artifacts to S3.

    Uploads images to  decks/<deck_id>/images/page-NN.png
    and the manifest to decks/<deck_id>/manifest.json (under AWS_S3_PUBLIC_BUCKET).
    Returns {deck_base, manifest_url, slide_count, step_count, manifest}.
    The manifest keeps RELATIVE image paths so the player just needs deck_base.
    """
    from extractor._s3 import S3Helper  # worker's shared S3 helper

    def _p(pct):
        if progress_cb:
            progress_cb(pct)

    s3 = S3Helper()
    tmp = Path(tempfile.mkdtemp(prefix="pptxanim_"))
    try:
        pptx_local = tmp / "deck.pptx"
        s3.download(pptx_url, pptx_local)
        _p(10)

        out = tmp / "out"
        manifest = convert(str(pptx_local), str(out), dpi=dpi)
        _p(70)

        prefix = f"decks/{deck_id}"
        img_dir = out / "images"
        pngs = sorted(img_dir.glob("*.png"))
        total = len(pngs) or 1
        for done, png in enumerate(pngs, start=1):
            s3.upload(png, f"{prefix}/images/{png.name}", content_type="image/png")
            _p(70 + int(25 * done / total))

        manifest_url = s3.upload(
            out / "manifest.json",
            f"{prefix}/manifest.json",
            content_type="application/json",
        )
        _p(100)

        return {
            "deck_base": f"https://{s3.bucket}.s3.amazonaws.com/{prefix}/",
            "manifest_url": manifest_url,
            "slide_count": len(manifest["slides"]),
            "step_count": sum(len(s) for s in manifest["slides"]),
            "manifest": manifest,
        }
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Convert a .pptx to animated-HTML assets.")
    ap.add_argument("pptx", help="input .pptx")
    ap.add_argument("out", help="output directory")
    ap.add_argument("--dpi", type=int, default=110, help="raster DPI (default 110)")
    args = ap.parse_args()
    m = convert(args.pptx, args.out, dpi=args.dpi)
    print(
        f"OK: {len(m['slides'])} slides, "
        f"{sum(len(s) for s in m['slides'])} build-step images -> {args.out}"
    )

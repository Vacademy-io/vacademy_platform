"""
Sound Planner — derives per-shot sound cues from the finished Director plan,
skill composer output, and narration emphasis signals. No LLM calls.

Design:
  1. Build a SOUND PALETTE once per video — 3-4 variations per role for
     variety. Topic-biased selection from script keywords (money → coins).
  2. Place cues at structural moments (transitions, reveals, emphasis)
     with subtle timing offsets for a natural feel.
  3. Use low volumes so sounds are background texture, not foreground.
  4. Respect global budgets so even a 30-shot video stays controlled.

The Director does NOT see sound information. Everything is derived from
signals the Director already produced for visual reasons.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set, Tuple

from sound_catalog import SoundCatalog, load_catalog


# ---------------------------------------------------------------------------
# Palette roles — the sonic vocabulary for one video
# ---------------------------------------------------------------------------
# Each video pre-selects ONE file for each of these roles. Every cue in the
# video draws from this fixed set so the viewer hears the same whoosh on
# every transition, the same chime on every reveal, etc.
PALETTE_ROLES = [
    "transition_whoosh",
    "impact",
    "ui_chime",
    "ui_click",
    "data_reveal",
    "ui_positive",
]

# Synonym map: bridges natural-language words in the script to
# tag-style words in sound descriptions. For example, a script about
# "money management" produces the keyword "money" which alone won't
# match description "FOLEY, COINS, DROP" — but the synonym "coin" will.
TOPIC_SYNONYMS: Dict[str, List[str]] = {
    "money":       ["coin", "cash", "register", "dollar"],
    "finance":     ["coin", "cash", "money", "register"],
    "budget":      ["coin", "cash", "money"],
    "payment":     ["coin", "cash", "register"],
    "sports":      ["ball", "whistle", "crowd", "stadium"],
    "basketball":  ["basketball", "bounce", "ball"],
    "football":    ["ball", "whistle", "crowd"],
    "cricket":     ["ball", "bat", "crowd"],
    "volleyball":  ["ball", "whistle"],
    "cooking":     ["kitchen", "sizzle", "chop", "pan", "timer"],
    "food":        ["kitchen", "chop", "bite", "chew"],
    "science":     ["laboratory", "beaker", "bubble", "science"],
    "chemistry":   ["laboratory", "beaker", "bubble"],
    "physics":     ["impact", "collision", "force"],
    "water":       ["water", "splash", "drip", "rain"],
    "nature":      ["bird", "water", "wind", "rain", "forest"],
    "fire":        ["fire", "flame", "blaze"],
    "technology":  ["digital", "electronic", "computer", "click", "beep"],
    "coding":      ["keyboard", "type", "click", "digital"],
    "gaming":      ["arcade", "game", "8 bit", "retro"],
    "music":       ["musical", "instrument", "melody", "chord"],
    "bell":        ["bell", "chime", "ring"],
    "magic":       ["magic", "spell", "wand", "sparkle"],
    "space":       ["sci fi", "space", "laser"],
    "military":    ["gun", "explosion", "warfare"],
    "construction":["hammer", "drill", "saw", "construction"],
    "office":      ["paper", "stapler", "keyboard", "mouse"],
    "school":      ["bell", "chime", "pencil", "paper"],
}


# ---------------------------------------------------------------------------
# Shot-type → signature cue table
# ---------------------------------------------------------------------------
_SIG = Tuple[str, Any, float]  # (role, placement, volume_mul)

SHOT_TYPE_CUE: Dict[str, Optional[_SIG]] = {
    "KINETIC_TITLE":   ("impact",            0.05,      0.65),
    "KINETIC_TEXT":    ("ui_click",          "sync[0]", 0.55),
    "VIDEO_HERO":      ("transition_whoosh", 0.00,      0.70),
    "IMAGE_HERO":      ("transition_whoosh", 0.00,      0.60),
    "IMAGE_SPLIT":     ("ui_chime",          0.10,      0.55),
    "DATA_STORY":      ("data_reveal",       "sync[0]", 0.65),
    "EQUATION_BUILD":  ("ui_chime",          "sync[0]", 0.55),
    "PROCESS_STEPS":   ("ui_click",          "sync[0]", 0.50),
    "INFOGRAPHIC_SVG": None,
    "TEXT_DIAGRAM":    ("ui_chime",          "sync[0]", 0.50),
    "LOWER_THIRD":     ("ui_chime",          0.10,      0.50),
    "ANNOTATION_MAP":  ("ui_click",          "sync[0]", 0.50),
    "PRODUCT_HERO":    ("transition_whoosh", 0.00,      0.65),
}

_FAMILY: Dict[str, str] = {
    "KINETIC_TITLE":   "title",
    "KINETIC_TEXT":    "title",
    "VIDEO_HERO":      "hero",
    "IMAGE_HERO":      "hero",
    "IMAGE_SPLIT":     "split",
    "DATA_STORY":      "data",
    "EQUATION_BUILD":  "data",
    "PROCESS_STEPS":   "diagram",
    "INFOGRAPHIC_SVG": "svg",
    "TEXT_DIAGRAM":    "diagram",
    "LOWER_THIRD":     "overlay",
    "ANNOTATION_MAP":  "diagram",
    "PRODUCT_HERO":    "hero",
}

_SHORT_SHOT = 2.0
_MIN_CUE_GAP = 0.30
_SILENCE_GAP_MIN = 0.60


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def plan_sounds(
    entries: List[Dict[str, Any]],
    shots: List[Dict[str, Any]],
    words: List[Dict[str, Any]],
    tier_config: Dict[str, Any],
    video_id: str = "",
    catalog: Optional[SoundCatalog] = None,
    script_text: str = "",
) -> None:
    """Mutate `entries` in place, adding `sound_cues` to each.

    The palette is built once from the script topic and reused for every
    cue in the video — same whoosh on every transition, same chime on
    every reveal. This gives the video a consistent sonic identity.
    """
    if not tier_config.get("sound_enabled"):
        for e in entries:
            e["sound_cues"] = []
        return

    cat = catalog if catalog is not None else load_catalog()
    if cat is None:
        for e in entries:
            e["sound_cues"] = []
        return

    # ── Step 1: build the video's sound palette (one file per role) ──
    palette = _build_sound_palette(cat, video_id, script_text)

    # ── Step 2: index Director shots for sync_point lookup ──
    shots_by_index: Dict[int, Dict[str, Any]] = {}
    for s in shots:
        try:
            idx = int(s.get("shot_index", 0))
        except (TypeError, ValueError):
            idx = 0
        shots_by_index[idx] = s

    max_per_shot: int = int(tier_config.get("sound_max_cues_per_shot", 2))
    max_per_video: int = int(tier_config.get("sound_max_cues_per_video", 20))

    prev_shot_type: Optional[str] = None
    total_cues = 0

    ordered = sorted(entries, key=lambda e: float(e.get("start", 0)))

    # Initialize sound_cues on every entry up front so transition cues for
    # shot N can be appended to entry N-1 *after* it has already been
    # finalized. The loop appends to its own entry's list, and the next
    # iteration's transition rule appends to the previous entry's list.
    for e in ordered:
        e["sound_cues"] = []

    for i, entry in enumerate(ordered):
        if total_cues >= max_per_video:
            prev_shot_type = str(entry.get("_shot_type", "") or "")
            continue

        shot_type = str(entry.get("_shot_type", "") or "")
        shot_idx = int(entry.get("index", 0))
        director_shot = shots_by_index.get(shot_idx, {})
        start_time = float(entry.get("start", 0.0))
        end_time = float(entry.get("end", start_time + 1.0))
        duration = max(0.01, end_time - start_time)

        cues: List[Dict[str, Any]] = []

        # ── Rule 1 (revised): pre-roll transition whoosh onto the PREVIOUS ──
        # entry so the transient (≈65% into the file) lands on the cut,
        # not after it. Sample-accurate: no natural-offset wobble.
        if i > 0 and prev_shot_type is not None and "transition_whoosh" in palette:
            prev_family = _FAMILY.get(prev_shot_type, "other")
            cur_family = _FAMILY.get(shot_type, "other")
            if prev_family != cur_family:
                prev_entry = ordered[i - 1]
                prev_dur = max(
                    0.01,
                    float(prev_entry.get("end", 0)) - float(prev_entry.get("start", 0)),
                )
                variations = palette["transition_whoosh"]
                sample = variations[0] if isinstance(variations, list) else variations
                whoosh_dur = max(0.25, min(1.5, float(sample.get("duration") or 0.5)))
                # Start the whoosh `whoosh_dur*0.65` before the cut so its
                # transient peak lands on the cut. Clamp to >= 0 so we never
                # bleed into a previous-previous shot.
                t_pre = max(0.0, prev_dur - whoosh_dur * 0.65)
                t_cue = _cue_from_palette(
                    palette, "transition_whoosh",
                    shot_idx, "transition", t=t_pre, volume_mul=1.0,
                    no_natural_offset=True,
                )
                if t_cue:
                    # Respect the previous entry's per-shot cap so a long
                    # busy shot at its limit doesn't go over.
                    prev_cap = 1 if prev_dur < _SHORT_SHOT else max_per_shot
                    if len(prev_entry["sound_cues"]) < prev_cap:
                        prev_entry["sound_cues"].append(_public_cue(t_cue))
                        total_cues += 1

        # ── Rule 2: Shot-type signature cue (one per shot, at sync[0] or fixed time) ──
        sig = SHOT_TYPE_CUE.get(shot_type)
        if sig is not None:
            role, placement, volume_mul = sig
            sig_cues = _resolve_signature_cue(
                palette=palette,
                role=role,
                placement=placement,
                volume_mul=volume_mul,
                shot=director_shot,
                start_time=start_time,
                duration=duration,
                shot_idx=shot_idx,
                # Title/impact hits must be sample-accurate so the punch
                # lands on the visual frame, not 30-80ms after it.
                no_natural_offset=(role in ("impact", "transition_whoosh")),
            )
            cues.extend(sig_cues)

        # ── Rule 3: Skill-derived audio events ──
        skill_events = entry.get("_skill_audio_events") or []
        for ev in skill_events:
            role = ev.get("role") or ""
            t = float(ev.get("t", 0.0))
            volume_mul_skill = float(ev.get("volume_mul", 1.0))
            if role not in palette:
                continue
            if t < 0 or t > duration:
                continue
            cue = _cue_from_palette(
                palette, role,
                shot_idx, f"skill:{ev.get('skill_id', '?')}",
                t=t, volume_mul=volume_mul_skill,
            )
            if cue:
                cues.append(cue)

        # ── Rule 4: Emphasis fallback for long empty shots ──
        if not cues and duration >= 2.5:
            anchor_t = _find_emphasis_anchor(words, start_time, end_time)
            if anchor_t is not None:
                cue = _cue_from_palette(
                    palette, "ui_chime",
                    shot_idx, "emphasis", t=anchor_t, volume_mul=0.80,
                )
                if cue:
                    cues.append(cue)

        # ── Rule 6: Dedup (same-role cues within MIN_GAP) ──
        cues = _dedup_and_space(cues, min_gap=_MIN_CUE_GAP)

        # ── Rule 5: Tier caps ──
        shot_cap = 1 if duration < _SHORT_SHOT else max_per_shot
        remaining = max(0, max_per_video - total_cues)
        cap = min(shot_cap, remaining)
        if len(cues) > cap:
            def _priority(c: Dict[str, Any]) -> Tuple[int, float]:
                is_transition = 1 if c.get("_source") == "transition" else 0
                return (is_transition, float(c.get("volume", 0)))
            cues.sort(key=_priority, reverse=True)
            cues = cues[:cap]

        cues.sort(key=lambda c: float(c.get("t", 0)))
        # Append local cues to whatever is already on the entry. A transition
        # cue from a previous iteration's pre-roll attaches to entry[i-1]
        # *after* entry[i-1] is finalized, so we must extend, not replace.
        entry["sound_cues"].extend(_public_cue(c) for c in cues)

        total_cues += len(cues)
        prev_shot_type = shot_type

    # Final pass: sort each entry's cues by t. Transition pre-rolls were
    # appended after their host entry's local cues were sorted, so the list
    # is no longer monotonic until we sort here.
    for e in ordered:
        e["sound_cues"].sort(key=lambda c: float(c.get("t", 0)))

    # Log palette summary
    _log_palette(palette, total_cues, len(ordered))


# ---------------------------------------------------------------------------
# Sound Palette — built once per video
# ---------------------------------------------------------------------------

def _extract_topic_keywords(script_text: str) -> List[str]:
    """Pull topic-signal words from the narration script.

    Returns lowercased keywords including synonym expansions. For example,
    "managing your money" → ["managing", "your", "money", "coin", "cash",
    "register", "dollar"] so sound descriptions like "FOLEY, COINS, DROP"
    get a match.
    """
    if not script_text:
        return []
    # Tokenize to unique lowercased words (3+ chars to skip articles)
    raw_words = set(re.findall(r"[a-zA-Z]{3,}", script_text.lower()))
    expanded: Set[str] = set(raw_words)
    for word in raw_words:
        synonyms = TOPIC_SYNONYMS.get(word, [])
        for syn in synonyms:
            expanded.add(syn)
    return list(expanded)


def _build_sound_palette(
    cat: SoundCatalog,
    video_id: str,
    script_text: str,
) -> Dict[str, Any]:
    """Pre-select 3-4 sound files per role for variety.

    Sounds within a role are rotated via a counter so consecutive
    transitions don't reuse the same file. Topic-biased selection
    from script keywords (money → coins, sports → whistle).
    """
    topic_kws = _extract_topic_keywords(script_text)
    palette: Dict[str, Any] = {}
    for role in PALETTE_ROLES:
        if not cat.has_role(role):
            continue
        # Pick up to 4 variations per role using different seeds
        variations = []
        seen_urls: Set[str] = set()
        for i in range(4):
            seed = f"{video_id}:palette:{role}:{i}"
            if topic_kws:
                picked = cat.resolve_for_topic(role, topic_kws, seed_key=seed)
            else:
                picked = cat.resolve(role, seed_key=seed)
            if picked and picked.get("url", "") not in seen_urls:
                variations.append(picked)
                seen_urls.add(picked.get("url", ""))
        if variations:
            palette[role] = variations  # List of dicts now, not single dict
            palette[f"_{role}_counter"] = 0  # rotation counter
    return palette


def _log_palette(
    palette: Dict[str, Any],
    total_cues: int,
    total_shots: int,
) -> None:
    parts = []
    for role in PALETTE_ROLES:
        entry = palette.get(role)
        if entry:
            if isinstance(entry, list):
                name = entry[0].get("description", "")[:25]
                parts.append(f"{role}={name} (+{len(entry)-1})")
            else:
                name = entry.get("description", "")[:35]
                parts.append(f"{role}={name}")
    if parts:
        print(f"   🎵 Sound palette: {', '.join(parts)}")
    print(
        f"   🔊 Sound Planner placed {total_cues} cues across "
        f"{total_shots} shots"
    )


# ---------------------------------------------------------------------------
# Cue resolution — always from the palette
# ---------------------------------------------------------------------------

def _cue_from_palette(
    palette: Dict[str, Any],
    role: str,
    shot_idx: int,
    slot: str,
    *,
    t: float,
    volume_mul: float,
    no_natural_offset: bool = False,
) -> Optional[Dict[str, Any]]:
    """Build a cue dict using a rotated file from the palette's variations.

    Each call advances the role's rotation counter so consecutive cues
    of the same role use different sound files.

    `no_natural_offset` skips the 30-80ms hash offset for cues whose
    placement must be sample-accurate (transition whooshes leading a cut,
    title impact hits). Default offset is fine for chimes/clicks.
    """
    variations = palette.get(role)
    if not variations:
        return None
    # Handle both old (single dict) and new (list) palette formats
    if isinstance(variations, dict):
        picked = variations
    else:
        counter_key = f"_{role}_counter"
        idx = palette.get(counter_key, 0) % len(variations)
        picked = variations[idx]
        palette[counter_key] = idx + 1

    # Apply volume reduction — sounds should be subtle background texture
    base_volume = picked.get("volume_hint", 0.5)
    # Reduce all volumes by 40% so they don't compete with narration
    volume = max(0.0, min(1.0, base_volume * volume_mul * 0.6))

    if no_natural_offset:
        adjusted_t = round(float(t), 3)
    else:
        # Add slight natural offset (0.03-0.08s) so sounds don't land exactly
        # on shot boundaries — feels more organic
        import hashlib
        offset_hash = int(hashlib.md5(f"{shot_idx}:{slot}".encode()).hexdigest()[:4], 16)
        natural_offset = 0.03 + (offset_hash % 50) / 1000.0  # 0.03-0.08s
        adjusted_t = max(0.0, round(float(t) + natural_offset, 3))

    return {
        "id": f"sfx_{shot_idx}_{slot}",
        "t": adjusted_t,
        "url": picked.get("url"),
        "volume": round(volume, 3),
        "role": role,
        "file_id": picked.get("file_id"),
        "duration": round(picked.get("duration", 0.0), 3),
        "_source": slot,
    }


def _resolve_signature_cue(
    palette: Dict[str, Any],
    role: str,
    placement: Any,
    volume_mul: float,
    shot: Dict[str, Any],
    start_time: float,
    duration: float,
    shot_idx: int,
    *,
    no_natural_offset: bool = False,
) -> List[Dict[str, Any]]:
    """Resolve a SHOT_TYPE_CUE entry. Always produces at most 1 cue now
    (sync[*] was changed to sync[0] — one event per shot, not per sync point).
    """
    if role not in palette:
        return []

    if isinstance(placement, (int, float)):
        t = float(placement)
        if t >= duration:
            return []
        cue = _cue_from_palette(palette, role, shot_idx, "signature",
                                t=t, volume_mul=volume_mul,
                                no_natural_offset=no_natural_offset)
        return [cue] if cue else []

    if isinstance(placement, str) and placement.startswith("sync["):
        sync_points = shot.get("sync_points") or []
        rel_times = _shot_relative_sync_times(sync_points, start_time, duration)
        if not rel_times:
            return []
        # Always pick only the FIRST sync point — one cue per shot max.
        t = rel_times[0]
        cue = _cue_from_palette(palette, role, shot_idx, "sync0",
                                t=t, volume_mul=volume_mul,
                                no_natural_offset=no_natural_offset)
        return [cue] if cue else []

    return []


def _shot_relative_sync_times(
    sync_points: List[Dict[str, Any]],
    start_time: float,
    duration: float,
) -> List[float]:
    out: List[float] = []
    for sp in sync_points:
        try:
            abs_t = float(sp.get("time", 0))
        except (TypeError, ValueError):
            continue
        rel = abs_t - start_time
        if -0.05 <= rel <= duration - 0.05:
            out.append(max(0.0, rel))
    return sorted(out)


# ---------------------------------------------------------------------------
# Rule 4 — Emphasis fallback
# ---------------------------------------------------------------------------

def _find_emphasis_anchor(
    words: List[Dict[str, Any]],
    shot_start: float,
    shot_end: float,
) -> Optional[float]:
    """Pick a single emphasis anchor inside a shot's window."""
    best_gap: Tuple[float, float] = (0.0, 0.0)
    prev_end = shot_start
    first_peak_rel: Optional[float] = None

    for w in words:
        try:
            w_start = float(w.get("start", 0.0))
            w_end = float(w.get("end", w_start))
        except (TypeError, ValueError):
            continue
        if w_end < shot_start or w_start > shot_end:
            continue
        text = str(w.get("word", "")).strip()
        if not text:
            continue

        gap = w_start - prev_end
        if gap >= _SILENCE_GAP_MIN and gap > best_gap[0]:
            trigger_abs = max(shot_start, w_start - 0.08)
            best_gap = (gap, trigger_abs - shot_start)

        if first_peak_rel is None and len(text) >= 7:
            first_peak_rel = max(0.0, w_start - shot_start)

        prev_end = w_end

    if best_gap[0] > 0:
        return round(best_gap[1], 3)
    if first_peak_rel is not None:
        return round(first_peak_rel, 3)
    return None


# ---------------------------------------------------------------------------
# Rule 6 — Dedup + suppression
# ---------------------------------------------------------------------------

def _dedup_and_space(
    cues: List[Dict[str, Any]],
    min_gap: float,
) -> List[Dict[str, Any]]:
    """Enforce min gap; transition + non-transition pairs co-exist."""
    if not cues:
        return cues
    ordered = sorted(cues, key=lambda c: float(c.get("t", 0)))
    kept: List[Dict[str, Any]] = []

    def _is_transition(c: Dict[str, Any]) -> bool:
        return c.get("_source") == "transition"

    for cue in ordered:
        t = float(cue.get("t", 0))
        if kept and (t - float(kept[-1].get("t", 0))) < min_gap:
            prev = kept[-1]
            both_non_transition = not _is_transition(prev) and not _is_transition(cue)
            if both_non_transition:
                if float(cue.get("volume", 0)) > float(prev.get("volume", 0)):
                    kept.pop()
                else:
                    continue
        kept.append(cue)
    return kept


# ---------------------------------------------------------------------------
# Payload cleanup
# ---------------------------------------------------------------------------

def _public_cue(cue: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": cue.get("id"),
        "t": cue.get("t"),
        "url": cue.get("url"),
        "volume": cue.get("volume"),
        "role": cue.get("role"),
        "duration": cue.get("duration"),
    }

"""
The ``course_invites_edit`` tool — invite links and payment plans for a course,
for the Assistant and the MCP server.

In Vacademy a course has no price field: an INVITE links the course's batch to a
PAYMENT OPTION (one or more plans), and the course's DEFAULT invite is what the
catalogue and enroll flows use. So "make this course ₹999" means: a payment
option with a ₹999 plan, an invite linking it to the batch, and (optionally)
that invite made the default.

Safety (no confirm card over MCP) — everything here is ADDITIVE:

* payment options / plans are only ever CREATED, never edited, so a plan shared
  with other courses can never change under them;
* invites are only ever created; re-pointing an invite at a new plan and making
  an invite the default are allowed only while the course is NOT ACTIVE.

Actions
    create_invite        new invite for a course (+ inline payment plan) → share link
    create_payment_plan  new payment option + plan, optionally attached to an invite of a non-live course
    make_default         make an invite the course's default (non-live courses)
"""
from __future__ import annotations

import json
import logging
import re
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from . import course_builder_data as cbd
from .assistant_tool_registry import ToolContext, ToolSpec

logger = logging.getLogger(__name__)

INVITES_EDIT_TOOL_NAME = "course_invites_edit"
INVITES_EDIT_GROUP_KEY = "course_invite_edits"
INVITES_EDIT_ACTIONS = ("create_invite", "create_payment_plan", "make_default")

PAYMENT_TYPES = ("FREE", "ONE_TIME", "SUBSCRIPTION")
FIELD_TYPES = ("text", "number", "dropdown")
_CURRENCY_RE = re.compile(r"^[A-Z]{3}$")
_MAX_PRICE = 10_000_000

PAYMENT_SPEC_DOC = (
    "PAYMENT = {type: FREE | ONE_TIME | SUBSCRIPTION, name?, currency (ISO, e.g. INR / USD — required unless FREE), "
    "require_approval?: bool (default false: learners get access as soon as they pay/register),\n"
    "  ONE_TIME: price, strike_price? (shown struck through), validity_days? (omit = lifetime access)\n"
    "  SUBSCRIPTION: plans: [{name, price, strike_price?, validity_days (e.g. 30, 90, 365)}] (1-6 plans)\n"
    "  FREE: validity_days? (omit = unlimited)}"
)

INVITES_EDIT_SCHEMA: Dict[str, Any] = {
    "type": "function",
    "function": {
        "name": INVITES_EDIT_TOOL_NAME,
        "description": (
            "Create invite links (the page learners enrol / pay through) and payment plans for a course. Never edits "
            "or deletes anything. Read courses(action='invites') and courses(action='payment_setup') first; never "
            "invent prices — ask the admin. Pick an `action`:\n"
            "- create_invite (course_id, payment: PAYMENT | payment_option_id, batch_ids? (required when the "
            "course has several batches — ask which session / level), name?, start_date?, end_date?, "
            "access_days?, landing?: {description_html, learning_outcome_html, about_html, target_audience_html, "
            "tags}, form_fields?: [{label, type: text|number|dropdown, required?, options?}], make_default?): a new "
            "invite. The registration form always starts with the institute's default fields (name, email, phone…); "
            "form_fields adds to them. Landing copy defaults to the course's own. Returns the shareable link.\n"
            "- create_payment_plan (payment: PAYMENT, invite_id?, course_id?): a new payment plan. With invite_id + "
            "course_id it replaces that invite's plan (only while the course is not live).\n"
            "- make_default (course_id, invite_id): the course's main enrolment link (only while the course is not "
            "live). Every new course already has a default invite at the institute's default price — make your new "
            "invite the default or the catalogue keeps using that one.\n"
            + PAYMENT_SPEC_DOC
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": list(INVITES_EDIT_ACTIONS)},
                "course_id": {"type": "string"},
                "invite_id": {"type": "string"},
                "payment": {"type": "object", "description": "PAYMENT (see description)."},
                "payment_option_id": {"type": "string", "description": "create_invite: reuse an existing plan from "
                                                                       "courses(action='payment_setup')."},
                "name": {"type": "string", "description": "create_invite: invite name (default: course name)."},
                "start_date": {"type": "string", "description": "YYYY-MM-DD (default today)."},
                "end_date": {"type": "string", "description": "YYYY-MM-DD, optional (link closes after it)."},
                "access_days": {"type": "integer", "description": "Days of access after enrolling (FREE invites)."},
                "landing": {"type": "object"},
                "form_fields": {"type": "array", "items": {"type": "object"}},
                "make_default": {"type": "boolean", "description": "create_invite: also make it the default."},
                "batch_ids": {"type": "array", "items": {"type": "string"},
                              "description": "Which batches (session × level, ids from courses(action='get')) the "
                                             "invite enrols into. Needed when the course has several; several make "
                                             "one bundled invite. make_default: limit to these batches."},
            },
            "required": ["action"],
        },
    },
}


def _err(code: str, **extra: Any) -> Dict[str, Any]:
    return cbd.err(code, **extra)


# ── payment option (pure) ────────────────────────────────────────────────

def _price(value: Any, label: str) -> Tuple[Optional[float], Optional[str]]:
    try:
        p = round(float(value), 2)
    except (TypeError, ValueError):
        return None, f"{label} must be a number"
    if p < 0 or p > _MAX_PRICE:
        return None, f"{label} must be between 0 and {_MAX_PRICE}"
    return p, None


def _days(value: Any) -> Tuple[Optional[int], Optional[str]]:
    if value in (None, ""):
        return None, None
    try:
        d = int(value)
    except (TypeError, ValueError):
        return None, "validity_days must be an integer"
    return (d, None) if 1 <= d <= 3650 else (None, "validity_days must be 1-3650")


def build_payment_option(ctx: ToolContext, spec: Any, fallback_name: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """A PaymentOptionDTO for POST /v1/payment-option, or (None, problem). Mirrors the dashboard's plan editor."""
    if not isinstance(spec, dict):
        return None, "payment must be an object — " + PAYMENT_SPEC_DOC
    ptype = str(spec.get("type") or "").upper().replace("UPFRONT", "ONE_TIME")
    if ptype not in PAYMENT_TYPES:
        return None, f"payment.type must be one of {', '.join(PAYMENT_TYPES)}"
    name = str(spec.get("name") or "").strip()[:120] or (
        f"{fallback_name} — {'Free' if ptype == 'FREE' else 'One-time' if ptype == 'ONE_TIME' else 'Subscription'}")
    currency = str(spec.get("currency") or "").upper().strip()
    if ptype != "FREE" and not _CURRENCY_RE.match(currency):
        return None, "payment.currency is required (3-letter ISO code, e.g. INR, USD) — ask the admin"
    currency = currency or "INR"
    option: Dict[str, Any] = {
        "name": name, "status": "ACTIVE", "source": "INSTITUTE", "source_id": ctx.principal.institute_id,
        "tag": None, "type": ptype, "require_approval": bool(spec.get("require_approval", False)),
        "plan_change_allowed": False,
    }

    def plan(pname: str, price: float, strike: Optional[float], days: Optional[int]) -> Dict[str, Any]:
        return {"name": pname, "status": "ACTIVE", "validity_in_days": days, "actual_price": price,
                "elevated_price": strike if strike and strike > price else price, "currency": currency,
                "description": name, "tag": "free", "feature_json": "[]", "plan_change_allowed": False}

    if ptype == "FREE":
        days, problem = _days(spec.get("validity_days"))
        if problem:
            return None, problem
        option["payment_plans"] = [plan(name, 0.0, None, days)]
        option["payment_option_metadata_json"] = json.dumps({
            "currency": currency, "features": [], "freeData": {},
            "config": {"free": {"accessType": "unlimited" if days is None else "limited", "validityDays": days}}})
        return option, None

    if ptype == "ONE_TIME":
        price, problem = _price(spec.get("price"), "payment.price")
        if problem:
            return None, problem
        if price <= 0:
            return None, "a ONE_TIME price must be above 0 — use type FREE for free access"
        strike = None
        if spec.get("strike_price") not in (None, ""):
            strike, problem = _price(spec.get("strike_price"), "payment.strike_price")
            if problem:
                return None, problem
        days, problem = _days(spec.get("validity_days"))
        if problem:
            return None, problem
        full = strike if strike and strike > price else price
        discount = {"type": "fixed", "amount": str(round(full - price, 2))} if full > price else {"type": "none"}
        option["payment_plans"] = [plan(name, price, strike, days)]
        option["payment_option_metadata_json"] = json.dumps({
            "currency": currency, "features": [],
            "config": {"upfront": {"fullPrice": str(full), "accessType": "lifetime" if days is None else "limited",
                                   "validityDays": days},
                       "planDiscounts": {"upfront": discount}},
            "upfrontData": {"fullPrice": str(full), "planDiscounts": {"upfront": discount}}})
        return option, None

    raw = spec.get("plans")
    if not isinstance(raw, list) or not 1 <= len(raw) <= 6:
        return None, "SUBSCRIPTION needs plans: 1-6 × {name, price, validity_days}"
    plans, intervals, discounts = [], [], {}
    for i, p in enumerate(raw):
        if not isinstance(p, dict):
            return None, f"plan {i + 1} must be an object"
        price, problem = _price(p.get("price"), f"plan {i + 1} price")
        if problem:
            return None, problem
        days, problem = _days(p.get("validity_days"))
        if problem or days is None:
            return None, problem or f"plan {i + 1} needs validity_days (e.g. 30 for monthly)"
        strike = None
        if p.get("strike_price") not in (None, ""):
            strike, problem = _price(p.get("strike_price"), f"plan {i + 1} strike_price")
            if problem:
                return None, problem
        pname = str(p.get("name") or f"{days} days").strip()[:80]
        full = strike if strike and strike > price else price
        plans.append(plan(pname, price, strike, days))
        intervals.append({"value": days, "unit": "days", "price": str(full), "title": pname, "features": []})
        discounts[f"interval_{i}"] = ({"type": "fixed", "amount": str(round(full - price, 2))}
                                      if full > price else {"type": "none"})
    option["payment_plans"] = plans
    option["payment_option_metadata_json"] = json.dumps({
        "currency": currency, "features": [], "unit": "days",
        "config": {"unit": "days", "subscription": {"unit": "days", "customIntervals": intervals},
                   "planDiscounts": discounts}})
    return option, None


def describe_option(option: Dict[str, Any]) -> Dict[str, Any]:
    plans = option.get("payment_plans") or []
    return {
        "id": option.get("id"), "name": option.get("name"), "type": option.get("type"),
        "requires_approval": option.get("require_approval"),
        "plans": [{"name": p.get("name"), "price": p.get("actual_price"),
                   "strike_price": p.get("elevated_price") if (p.get("elevated_price") or 0) > (p.get("actual_price") or 0) else None,
                   "currency": p.get("currency"), "validity_days": p.get("validity_in_days")} for p in plans],
    }


# ── registration form (pure) ─────────────────────────────────────────────

def _snake(name: str) -> str:
    return re.sub(r"[^a-z0-9_]", "", re.sub(r"\s+", "_", name.strip().lower()))


def form_fields_payload(ctx: ToolContext, defaults: List[Dict[str, Any]], extra: Any) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """The invite's institute_custom_fields: the institute defaults (reused by id) + extra new fields."""
    fields: List[Dict[str, Any]] = []
    seen: set = set()
    for d in defaults:
        cf = d.get("custom_field") or {}
        key = cf.get("fieldKey") or cf.get("field_key") or _snake(cf.get("fieldName") or "")
        if not cf.get("id") or cf.get("isHidden") or str(d.get("status") or "ACTIVE") != "ACTIVE" or key in seen:
            continue
        seen.add(key)
        required = d.get("is_mandatory") if d.get("is_mandatory") is not None else bool(cf.get("isMandatory"))
        fields.append(_field(ctx, len(fields), cf.get("id"), key, cf.get("fieldName") or key,
                             cf.get("fieldType") or "text", cf.get("config") or "", bool(required)))
    if not fields:
        for key, label in (("full_name", "Full Name"), ("email", "Email"), ("phone_number", "Phone Number")):
            seen.add(key)
            fields.append(_field(ctx, len(fields), "", key, label, "text", "", True))
    for i, f in enumerate(extra or []):
        if not isinstance(f, dict) or not str(f.get("label") or "").strip():
            return [], f"form_fields[{i}] needs a label"
        label = str(f["label"]).strip()[:80]
        ftype = str(f.get("type") or "text").lower()
        if ftype not in FIELD_TYPES:
            return [], f"form_fields[{i}].type must be one of {', '.join(FIELD_TYPES)}"
        key = _snake(label)
        if not key or key in seen:
            continue  # already on the form
        seen.add(key)
        config = ""
        if ftype == "dropdown":
            opts = [str(o).strip() for o in (f.get("options") or []) if str(o).strip()]
            if len(opts) < 2:
                return [], f"form_fields[{i}] (dropdown) needs at least 2 options"
            config = json.dumps([{"id": n + 1, "value": o, "label": o} for n, o in enumerate(opts)])
        fields.append(_field(ctx, len(fields), "", key, label, ftype, config, bool(f.get("required", False))))
    return fields, None


def _field(ctx: ToolContext, order: int, cf_id: str, key: str, label: str, ftype: str, config: str,
           required: bool) -> Dict[str, Any]:
    return {
        "id": "", "institute_id": ctx.principal.institute_id, "type": "", "type_id": "",
        "individual_order": order, "is_mandatory": required,
        "custom_field": {
            "guestId": "", "id": cf_id or "", "fieldKey": key, "fieldName": label, "fieldType": ftype,
            "defaultValue": "", "config": config, "formOrder": order, "isMandatory": required,
            "isFilter": True, "isSortable": True, "createdAt": "", "updatedAt": "", "sessionId": "",
            "liveSessionId": "", "customFieldValue": "", "groupName": "", "status": "ACTIVE",
        },
    }


def _iso_day(value: Any) -> Tuple[Optional[str], Optional[str]]:
    if value in (None, ""):
        return None, None
    try:
        return date.fromisoformat(str(value)[:10]).isoformat(), None
    except ValueError:
        return None, "dates must be YYYY-MM-DD"


# ── shared steps ─────────────────────────────────────────────────────────

def _course_and_batches(ctx: ToolContext, course_id: Any) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """The course and its ACTIVE batches (session × level), or an error."""
    course = cbd.course_row(ctx, str(course_id or ""))
    if not course:
        return None, [], _err("unknown_course", message="No such course in this institute. Use courses(action='list').")
    batches = cbd.course_batches(ctx, course["id"])
    if not batches:
        return None, [], _err("no_batch", message="This course has no active batch to enrol into.")
    return course, batches, None


def _batch_view(b: Dict[str, Any]) -> Dict[str, Any]:
    return {"id": b["id"], "name": b["name"], "session": b.get("session"), "level": b.get("level")}


def pick_batches(batches: List[Dict[str, Any]], requested: Any) -> Tuple[Optional[List[str]], Optional[Dict[str, Any]]]:
    """
    Which batches an invite enrols into. A one-batch course needs no choice; a
    course with several sessions / levels needs `batch_ids` — guessing would
    sell the wrong class or year.
    """
    ids = [str(x) for x in (requested or []) if x]
    known = {b["id"] for b in batches}
    if ids:
        unknown = [i for i in ids if i not in known]
        if unknown:
            return None, _err("unknown_batch", message="Some batch_ids are not batches of this course.",
                              batch_ids=unknown, batches=[_batch_view(b) for b in batches])
        return list(dict.fromkeys(ids)), None
    if len(batches) == 1:
        return [batches[0]["id"]], None
    return None, _err("choose_batch",
                      message="This course has several batches (session × level). Ask the admin which one(s) this "
                              "invite is for and pass batch_ids; several batch_ids make ONE bundled invite that "
                              "enrols the learner into all of them.",
                      batches=[_batch_view(b) for b in batches])


async def _create_option(ctx: ToolContext, spec: Any, fallback_name: str,
                         vendors: Optional[List[Dict[str, str]]] = None) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    option, problem = build_payment_option(ctx, spec, fallback_name)
    if problem:
        return None, _err("invalid_payment", message=problem)
    if option["type"] != "FREE":
        vendors = vendors if vendors is not None else await cbd.payment_vendors(ctx)
        if not vendors:
            return None, _err("no_payment_gateway",
                              message="This institute has no payment gateway set up, so paid plans cannot take payments. "
                                      "An admin connects one under Settings → Payment; until then only FREE works.")
    saved = await cbd.admin_core(ctx, "POST", "/admin-core-service/v1/payment-option", body=option)
    if cbd.is_error(saved) or not isinstance(saved, dict) or not saved.get("id"):
        return None, _err("save_failed", message="The payment plan could not be created.",
                          detail=saved.get("message") if isinstance(saved, dict) else None)
    return saved, None


async def _make_default(ctx: ToolContext, invite_id: str, batch: str) -> Any:
    return await cbd.admin_core(
        ctx, "PUT", "/admin-core-service/v1/enroll-invite/update-default-enroll-invite-config",
        params={"enrollInviteId": invite_id, "packageSessionId": batch},
    )


async def _invite_link(ctx: ToolContext, invite_id: str) -> Dict[str, Any]:
    full = await cbd.admin_core(ctx, "GET", f"/admin-core-service/v1/enroll-invite/{ctx.principal.institute_id}/{invite_id}")
    if not isinstance(full, dict) or cbd.is_error(full):
        return {}
    link = full.get("short_url")
    if not link and full.get("invite_code"):
        from .website_data import learner_portal_base
        base = learner_portal_base(ctx)
        if base:
            base = base if base.startswith("http") else f"https://{base}"
            link = (f"{base}/learner-invitation-response?instituteId={ctx.principal.institute_id}"
                    f"&inviteCode={full['invite_code']}")
    return {"link": link, "invite_code": full.get("invite_code"), "availability": full.get("availability_status")}


# ── actions ──────────────────────────────────────────────────────────────

async def _action_create_invite(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    course, batches, error = _course_and_batches(ctx, args.get("course_id"))
    if error:
        return error
    batch_ids, error = pick_batches(batches, args.get("batch_ids"))
    if error:
        return error
    if not args.get("payment") and not args.get("payment_option_id"):
        return _err("missing_argument", action="create_invite", needs=["payment or payment_option_id"],
                    message="Ask the admin whether the course is free or paid (and the price) — never assume.")
    start, problem = _iso_day(args.get("start_date") or date.today().isoformat())
    end, problem2 = _iso_day(args.get("end_date"))
    if problem or problem2:
        return _err("bad_request", message=problem or problem2)
    if end and start and end < start:
        return _err("bad_request", message="end_date is before start_date")
    access_days = args.get("access_days")
    if access_days not in (None, ""):
        try:
            access_days = int(access_days)
        except (TypeError, ValueError):
            return _err("bad_request", message="access_days must be an integer")
        if not 1 <= access_days <= 3650:
            return _err("bad_request", message="access_days must be 1-3650")
    else:
        access_days = None

    defaults = await cbd.admin_core(ctx, "GET", "/admin-core-service/common/custom-fields",
                                    params={"instituteId": ctx.principal.institute_id})
    fields, problem = form_fields_payload(ctx, defaults if isinstance(defaults, list) else [], args.get("form_fields"))
    if problem:
        return _err("invalid_form_fields", message=problem)

    vendors = await cbd.payment_vendors(ctx)
    if args.get("payment_option_id"):
        option_id = str(args["payment_option_id"])
        options = await cbd.admin_core(
            ctx, "POST", "/admin-core-service/v1/payment-option/get-payment-options",
            body={"source": "INSTITUTE", "source_id": ctx.principal.institute_id, "exclude_types": ["CPO"]})
        option = next((o for o in options if isinstance(o, dict) and o.get("id") == option_id), None) \
            if isinstance(options, list) else None
        if option is None:
            return _err("unknown_payment_option", message="No such payment plan; see courses(action='payment_setup').")
        if option.get("type") not in ("FREE", "DONATION") and not vendors:
            return _err("no_payment_gateway", message="No payment gateway is set up; only FREE plans can be used.")
    else:
        option, error = await _create_option(ctx, args["payment"], course["name"], vendors)
        if error:
            return error

    landing = args.get("landing") if isinstance(args.get("landing"), dict) else {}
    tags = landing.get("tags") if isinstance(landing.get("tags"), list) else \
        [t for t in (course.get("tags") or "").split(",") if t]
    meta = {
        "course": course["name"],
        "description": landing.get("description_html") or course.get("about_the_course") or "",
        "learningOutcome": landing.get("learning_outcome_html") or course.get("why_learn") or "",
        "aboutCourse": landing.get("about_html") or course.get("about_the_course") or "",
        "targetAudience": landing.get("target_audience_html") or course.get("who_should_learn") or "",
        "coursePreview": course.get("course_preview_image_media_id") or "",
        "courseBanner": course.get("course_banner_media_id") or "",
        "courseMedia": {"type": "", "id": ""},
        "tags": [str(t)[:40] for t in tags][:10],
        "showRelatedCourses": False, "includeInstituteLogo": True, "blendHeaderWithBackground": False,
        "restrictToSameBatch": False, "includePaymentPlans": True, "customHtml": "",
    }
    vendor = vendors[0] if vendors else {}
    currency = next((p.get("currency") for p in option.get("payment_plans") or [] if p.get("currency")), None) or "INR"
    name = str(args.get("name") or course["name"]).strip()[:120]
    invite_body = {
        "name": name, "start_date": start, "end_date": end, "status": "ACTIVE",
        "institute_id": ctx.principal.institute_id, "vendor": vendor.get("vendor"),
        "vendor_id": vendor.get("vendor_id") or vendor.get("vendor"), "currency": currency, "tag": "",
        "is_bundled": len(batch_ids) > 1, "learner_access_days": access_days,
        "web_page_meta_data_json": json.dumps(meta),
        "setting_json": json.dumps({"postformfillConfiguration": {"showLoginButton": True}}),
        "institute_custom_fields": fields,
        "package_session_to_payment_options": [
            {"package_session_id": bid, "payment_option": {"id": option["id"]}, "status": "ACTIVE"}
            for bid in batch_ids],
    }
    created = await cbd.admin_core(ctx, "POST", "/admin-core-service/v1/enroll-invite", body=invite_body)
    invite_id = created.strip().strip('"') if isinstance(created, str) else (
        created.get("id") if isinstance(created, dict) and not cbd.is_error(created) else None)
    if not invite_id:
        return _err("save_failed", message="The invite could not be created.",
                    detail=created.get("message") if isinstance(created, dict) else None,
                    payment_option_id=option.get("id"))
    made_default = False
    notes = []
    if args.get("make_default"):
        if course["status"] == cbd.STATUS_ACTIVE:
            notes.append("Not made the default: the course is live — change its default invite in the dashboard.")
        else:
            results = [await _make_default(ctx, invite_id, bid) for bid in batch_ids]
            made_default = not any(cbd.is_error(r) for r in results)
            if not made_default:
                notes.append("The invite was created but could not be made the default for every batch.")
    elif course["status"] != cbd.STATUS_ACTIVE:
        notes.append("This is not the course's default invite yet; call make_default if catalogue enrolments "
                     "should use this price.")
    link = await _invite_link(ctx, invite_id)
    by_id = {b["id"]: b for b in batches}
    return {
        "invite": {"id": invite_id, "name": name, "is_default": made_default, **link,
                   "batches": [_batch_view(by_id[b]) for b in batch_ids], "bundled": len(batch_ids) > 1,
                   "form_fields": [f["custom_field"]["fieldName"] for f in fields]},
        "payment": describe_option(option),
        "course": {"id": course["id"], "name": course["name"], "status": course["status"]},
        "notes": notes + ([] if course["status"] == cbd.STATUS_ACTIVE else [
            "Learners can only enrol once the course is approved and live (course_edit(submit_for_review))."]),
    }


async def _action_create_payment_plan(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    if not args.get("payment"):
        return _err("missing_argument", action="create_payment_plan", needs=["payment"])
    invite_id = str(args.get("invite_id") or "").strip()
    course = invite = None
    if invite_id:
        course, batches, error = _course_and_batches(ctx, args.get("course_id"))
        if error:
            return error
        if course["status"] == cbd.STATUS_ACTIVE:
            return _err("course_is_live", message="This course is live; change its invite's plan in the dashboard. "
                                                  "You can still create a NEW invite with create_invite.")
        invite = cbd.invite_row(ctx, invite_id, [b["id"] for b in batches])
        if not invite:
            return _err("unknown_invite", message="No such invite for this course. Use courses(action='invites').")
    option, error = await _create_option(ctx, args["payment"], (course or {}).get("name") or "Course")
    if error:
        return error
    result: Dict[str, Any] = {"payment": describe_option(option)}
    if invite:
        swapped = await cbd.admin_core(
            ctx, "PUT", "/admin-core-service/v1/enroll-invite/enroll-invite-payment-option",
            # One replacement per batch the invite enrols into, so a bundled invite stays whole.
            body=[{"enroll_invite_id": invite_id, "update_payment_options": [{
                "old_package_session_payment_option_id": link["link_id"],
                "new_package_session_payment_option": {
                    "package_session_id": link["package_session_id"], "payment_option": {"id": option["id"]},
                    "enroll_invite_id": invite_id, "status": "ACTIVE"},
            } for link in invite["links"]]}],
        )
        if cbd.is_error(swapped):
            result["notes"] = ["The plan was created but could not be attached to the invite; attach it in the dashboard."]
        else:
            result["invite"] = {"id": invite_id, "name": invite["name"], "link": invite.get("short_url")}
            result["notes"] = [f"'{invite['name']}' now charges this plan (its previous plan is no longer offered on it)."]
    else:
        result["next"] = "Use payment_option_id with create_invite to put this plan on a new invite."
    return result


async def _action_make_default(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    if not args.get("invite_id"):
        return _err("missing_argument", action="make_default", needs=["course_id", "invite_id"])
    course, batches, error = _course_and_batches(ctx, args.get("course_id"))
    if error:
        return error
    if course["status"] == cbd.STATUS_ACTIVE:
        return _err("course_is_live", message="This course is live; change its default invite in the dashboard.")
    invite = cbd.invite_row(ctx, str(args["invite_id"]), [b["id"] for b in batches])
    if not invite:
        return _err("unknown_invite", message="No such invite for this course. Use courses(action='invites').")
    # The default invite is per batch: by default make it the default of every batch it enrols into.
    targets = invite["batch_ids"]
    if args.get("batch_ids"):
        targets = [b for b in invite["batch_ids"] if b in {str(x) for x in args["batch_ids"]}]
        if not targets:
            return _err("bad_request", message="This invite does not enrol into any of those batches.")
    by_id = {b["id"]: b for b in batches}
    failed = []
    for bid in targets:
        if cbd.is_error(await _make_default(ctx, invite["id"], bid)):
            failed.append(by_id.get(bid, {}).get("name", bid))
    if len(failed) == len(targets):
        return _err("save_failed", message="The invite could not be made the default.")
    return {"default_invite": {"id": invite["id"], "name": invite["name"], "link": invite.get("short_url"),
                               "default_for": [_batch_view(by_id[b]) for b in targets if b in by_id
                                               and by_id[b]["name"] not in failed]},
            "failed_batches": failed,
            "course": {"id": course["id"], "name": course["name"]}}


_ACTIONS = {"create_invite": _action_create_invite, "create_payment_plan": _action_create_payment_plan,
            "make_default": _action_make_default}


async def execute_course_invites_edit(args: Dict[str, Any], ctx: ToolContext) -> str:
    action = str((args or {}).get("action") or "").strip()
    handler = _ACTIONS.get(action)
    if handler is None:
        return json.dumps(_err("unknown_action", action=action, available=list(INVITES_EDIT_ACTIONS)))
    result = await handler(args or {}, ctx)
    if isinstance(result, dict) and "action" not in result:
        result = {"action": action, **result}
    return json.dumps(result, ensure_ascii=False, default=str)


INVITES_EDIT_TOOLS: Dict[str, ToolSpec] = {
    INVITES_EDIT_TOOL_NAME: ToolSpec(
        name=INVITES_EDIT_TOOL_NAME,
        schema=INVITES_EDIT_SCHEMA,
        executor=execute_course_invites_edit,
        required_permission=None,
        setting_key=INVITES_EDIT_GROUP_KEY,
        default_enabled=False,
        default_roles=None,
        phase=3,
        mode="WRITE",
    ),
}


def _register() -> None:
    from .assistant_tool_registry import ASSISTANT_TOOLS, GROUP_LABELS
    ASSISTANT_TOOLS.update(INVITES_EDIT_TOOLS)
    GROUP_LABELS.update({INVITES_EDIT_GROUP_KEY: "Courses: invite links & payment plans"})


_register()

__all__ = ["INVITES_EDIT_TOOLS", "INVITES_EDIT_TOOL_NAME", "INVITES_EDIT_GROUP_KEY", "INVITES_EDIT_ACTIONS",
           "INVITES_EDIT_SCHEMA", "execute_course_invites_edit", "build_payment_option", "form_fields_payload",
           "describe_option"]

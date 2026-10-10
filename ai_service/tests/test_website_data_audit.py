"""
website(action='data_inventory' | 'data_audit') and context(detail=true).

The Brahm Varchas build found its data problems by hand (specs/INTEGRATION.md
"Fidelity gaps", bv/data_changes.json): courses with no format or FOR tag,
Gita Natyam in no stream tab, Rajaswala not on the catalogue, ten paid invites
still on Stripe after the institute moved to Razorpay, authored prices that
went stale, a path the Figma named that does not exist, a popular chip that
opens an empty category. The inventory below is that institute's data as it
was then (course tags from data_changes.json `existing_tags`, vendors from
invite_vendors.json), checked against the real site (the admin fixture).
"""
import copy
import json
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402

from app.schemas.auth import PinnedPrincipal  # noqa: E402
from app.services import assistant_tools_website as website_mod  # noqa: E402
from app.services import course_builder_data  # noqa: E402
from app.services import website_data  # noqa: E402
from app.services.assistant_tool_registry import ToolContext  # noqa: E402
from app.services.catalogue_course_rules import (  # noqa: E402
    card_format_keys,
    course_languages_of,
    language_of_row,
    resolve_course_formats,
)
from app.services.website_data_audit import audit_site_data, site_invite_ids  # noqa: E402

FIXTURE = (Path(__file__).resolve().parents[2] / "frontend-admin-dashboard" / "src" / "routes" / "manage-pages"
           / "-components" / "__fixtures__" / "brahm-varchas-site.json")

ADMIN = "https://admin.example.org"

# (id, name, published, level, tags, invite vendor, payment type, price)
BV_COURSES = [
    ('efa3bd68-98bb-428c-a098-bcab345f84a6', 'Gita Natyam', True, None, '', 'STRIPE', 'FREE', 0.0),
    ('cd3c4d85-634a-468c-a85d-db5513477134', 'Principles of wellness for maintaining health', True, None, 'english,swasthya,swasthavritta', 'RAZORPAY', 'ONE_TIME', 251.0),
    ('85ac1843-6261-4bc3-8c42-cca1768ce77c', 'Raghuveer Gadyam Learning Intensive', True, None, 'english,shastra,stotra', 'STRIPE', 'FREE', 0.0),
    ('8610911c-382c-41a9-9e33-2e4e0882282f', 'Rajaswala Paricharya', False, None, 'english,swasthya,rajaswala', 'RAZORPAY', 'ONE_TIME', 1001.0),
    ('2dbf6c16-c7ff-4172-8013-69d3ace62d4c', 'Ram Lekhan Kala Karyashala - A workshop', True, None, 'hindi,kala,lekhan-kala', 'RAZORPAY', 'FREE', 0.0),
    ('84218ef2-1fb8-4d7d-9893-93a710d14871', 'Rishi Intelligence', True, None, 'english,shastra,rishi-gyan', 'STRIPE', 'ONE_TIME', 121.0),
    ('27445cf9-8906-402f-b13c-066910bb62a1', 'True Gurukul Shiksha', True, None, 'english,shiksha,gurukul-shiksha', 'STRIPE', 'ONE_TIME', 151.0),
    ('f7c3b58e-b3bc-4d04-b897-e250ecf60b3a', 'Vedic Garbha Vigyan (Encyclopedia)', True, None, 'english,swasthya,garbha-vigyan', 'RAZORPAY', 'ONE_TIME', 251.0),
    ('7c12a9ec-22c3-4c55-ada1-2a93e107816f', 'Vedic Parenting - eBook', True, None, 'english,dharma,vedic-parenting', 'STRIPE', 'ONE_TIME', 251.0),
    ('334297b0-4f14-463d-886a-c32380519649', 'गर्भ विज्ञान (एन्साइक्लोपीडीया)', True, None, 'hindi,swasthya,garbha-vigyan', 'RAZORPAY', 'ONE_TIME', 201.0),
    ('ffa7f8d1-4f12-4373-8018-4a9decbc1624', 'गीतायन - eBook', True, 'eBook', 'hindi,shastra,gita', 'STRIPE', 'ONE_TIME', 51.0),
    ('0885a565-d814-4b84-95d6-f821b274736b', 'गुरुकुल शिक्षा', True, None, 'hindi,shiksha,gurukul-shiksha', 'STRIPE', 'ONE_TIME', 151.0),
    ('c150dfcf-96e0-4712-b709-b0528e1f4a09', 'वैदिक पेरेंटिंग - ई पुस्तक', True, None, 'hindi,dharma,vedic-parenting', 'STRIPE', 'ONE_TIME', 251.0),
    ('f47f4dac-7964-4538-a20b-2c224435379e', 'स्वस्थ रहने के लिए स्वास्थ्य के सिद्धांत', True, None, 'hindi,swasthya,swasthavritta', 'RAZORPAY', 'ONE_TIME', 51.0),
    ('438fae32-2ae9-4f8f-b19e-c8364b480981', 'Martand: The Unforgotten Sun Temple | Short Film', True, 'Short Film', 'english,bharat,mandir', 'STRIPE', 'FREE', 0.0),
    ('621f78e7-8d7e-4528-807e-ae4c18a99fb3', 'गदर', True, 'eBook', 'hindi,bharat,itihas', 'STRIPE', 'ONE_TIME', 121.0),
    ('d9c4c1aa-9d5c-4b2e-baff-2a3a1739e572', 'चेन्नकेशव मंदिर, सोमनाथपुरा', True, 'Article/Essay', 'hindi,bharat,mandir', 'STRIPE', 'ONE_TIME', 175.0),
    ('0907fc01-51b4-451a-bd1f-f5f319587cc8', 'ज्येष्ठेश्वर - एक प्राचीन शिवालय | लघु चलचित्र (शॉर्ट फिल्म)', True, 'Short Film', 'hindi,bharat,mandir', 'STRIPE', 'FREE', 0.0),
    ('6c10d627-f232-4563-8c76-84eba4cfa712', 'झाँसी फाइल्स', True, 'eBook', 'hindi,bharat,itihas', 'STRIPE', 'ONE_TIME', 121.0),
    ('3d82a809-33da-41c1-b7aa-486bbdf37edb', 'दक्षिण की अयोध्या मदुरांतकम नगरी का एरि कात्त रामर मंदिर', True, 'Article/Essay', 'hindi,bharat,mandir', 'STRIPE', 'FREE', 0.0),
    ('90ee7592-6d1c-434d-98a1-e98396c54d83', 'मार्तंड: अविस्मरणीय सूर्य मंदिर | लघु चलचित्र (शॉर्ट फिल्म)', True, 'Short Film', 'hindi,bharat,mandir', 'STRIPE', 'FREE', 0.0),
    ('212026a8-8251-4315-ab08-b5c399d1ae16', 'मित्रमेला', True, 'eBook', 'hindi,bharat,itihas', 'STRIPE', 'ONE_TIME', 121.0),
    ('22d87df1-cb76-4101-a228-8aa20028dd07', 'मैकलसुता नर्मदा मैया के दर्शन', True, 'Article/Essay', 'hindi,bharat,mandir', 'STRIPE', 'FREE', 0.0),
]
GITA_NATYAM = "efa3bd68-98bb-428c-a098-bcab345f84a6"
RAJASWALA = "8610911c-382c-41a9-9e33-2e4e0882282f"
GITAYAN = "ffa7f8d1-4f12-4373-8018-4a9decbc1624"
RAJASWALA_INVITE = "b6d3bd0d-db65-43fe-9cdb-07e67e8aed01"

# folders_plan.py: stream slug → [(category slug, coming soon)]
BV_STREAMS = [
    ("shastra", "Scriptures | Texts", [("gita", False), ("stotra", False), ("rishi-gyan", False)]),
    ("bharat", "Orbiting Bharat", [("mandir", False), ("itihas", False)]),
    ("shiksha", "Education", [("gurukul-shiksha", False), ("ayurveda-shiksha", True), ("vaidik-shikshan", True),
                              ("katha-kathan", True), ("bhartiya-khel", True), ("khagol", True), ("chhanda", True),
                              ("sanskrit", True), ("ganit", True), ("bal-shala", True)]),
    ("swasthya", "Health | Ayurveda", [("swasthavritta", False), ("garbha-vigyan", False), ("rajaswala", False)]),
    ("dharma", "Virtue | Civilisation", [("vedic-parenting", False)]),
    ("kala", "Skills | Craft", [("lekhan-kala", False)]),
]
BV_PATHS = {"swasthya": ("forbvy", "A woman's life stages"), "bharat": ("92ogt2", "India of temples"),
            "shastra": ("u5rgwb", "First steps in Scriptures | Texts"),
            "shiksha": ("ks61g1", "Gurukul Education / Indian Education")}
LIBRARY_ID = "904e2152-f6b8-4c49-bfa0-e8849d13825f"


def bv_courses():
    gs = load_fixture()["globalSettings"]
    languages = course_languages_of(gs.get("courseLanguages"))
    formats = resolve_course_formats(gs)
    out = []
    for cid, name, published, level, tags, vendor, ptype, price in BV_COURSES:
        row = {"level_name": level or "default", "comma_separeted_tags": tags}
        lang = language_of_row(row, languages)
        out.append({
            "id": cid, "name": name, "status": "ACTIVE", "published_to_catalogue": published,
            "tags": [t for t in tags.split(",") if t], "levels": [level] if level else None,
            "language_detected": [lang["code"]] if lang else [],
            "format_detected": card_format_keys([row], formats),
            "price": price, "currency": "INR", "default_invite_id": f"inv-{cid[:8]}", "vendor": vendor,
            "payment_type": ptype,
        })
    return out


def bv_library():
    roots = []
    for slug, subtitle, cats in BV_STREAMS:
        children = [{"id": f"f-{c}", "node_type": "FOLDER", "slug": c, "title": c, "coming_soon": soon,
                     "status": "ACTIVE", "key": c, "tag": c} for c, soon in cats]
        if slug in BV_PATHS:
            code, name = BV_PATHS[slug]
            children.append({"id": f"p-{code}", "node_type": "PRODUCT_PAGE", "product_page_code": code,
                             "product_page_name": name, "product_page_status": "ACTIVE", "status": "ACTIVE"})
        roots.append({"id": f"f-{slug}", "node_type": "FOLDER", "slug": slug, "subtitle": subtitle, "title": slug,
                      "status": "ACTIVE", "key": slug, "tag": slug, "children": children})
    return {"id": LIBRARY_ID, "name": "Knowledge Streams", "roots": roots}


def bv_inventory(**overrides):
    inv = {
        "courses": bv_courses(),
        "folder_libraries": [bv_library()],
        "product_pages": [
            {"id": "pp-store", "code": "7pc4tl", "name": "Knowledge Streams – Store", "status": "ACTIVE",
             "steps": [{"step": 1, "course_id": GITAYAN}]},
            {"id": "pp-woman", "code": "forbvy", "name": "A woman's life stages", "status": "ACTIVE",
             "steps": [{"step": 1, "course_id": RAJASWALA, "enroll_invite_id": RAJASWALA_INVITE, "price": 1001.0}]},
            {"id": "pp-temples", "code": "92ogt2", "name": "India of temples", "status": "ACTIVE", "steps": [{"step": 1}]},
            {"id": "pp-scriptures", "code": "u5rgwb", "name": "Scriptures", "status": "ACTIVE", "steps": [{"step": 1}]},
            {"id": "pp-gurukul", "code": "ks61g1", "name": "Gurukul", "status": "ACTIVE", "steps": [{"step": 1}]},
        ],
        "payment_vendors": ["RAZORPAY"],      # the institute had moved to Razorpay; 10 invites still said Stripe
        "invites_by_id": {RAJASWALA_INVITE: {"id": RAJASWALA_INVITE, "price": 1001.0, "vendor": "RAZORPAY"}},
    }
    inv.update(overrides)
    return inv


def load_fixture():
    if not FIXTURE.exists():
        pytest.skip("Brahm Varchas site fixture not present")
    return json.loads(FIXTURE.read_text())


def checks(result, check=None):
    return [i for i in result["issues"] if check is None or i["check"] == check]


def names(result, check):
    return sorted((i.get("course") or {}).get("name") for i in checks(result, check))


# ── the hand-found issues, found ─────────────────────────────────────────
def test_gita_natyam_is_in_no_stream_tab():
    result = audit_site_data(load_fixture(), bv_inventory(), admin_base=ADMIN)
    [issue] = checks(result, "course_no_stream")
    assert issue["course"]["id"] == GITA_NATYAM and issue["severity"] == "warning"
    assert "no stream or category tag" in issue["message"]
    assert issue["link"] == f"{ADMIN}/study-library/courses/course-details?courseId={GITA_NATYAM}"
    # …and, with no tags at all, it has no language for the EN/HI chips either.
    assert names(result, "course_no_language") == ["Gita Natyam"]


def test_rajaswala_is_not_on_the_catalogue_and_its_category_is_empty():
    result = audit_site_data(load_fixture(), bv_inventory(), admin_base=ADMIN)
    [issue] = checks(result, "course_not_on_catalogue")
    assert issue["course"]["id"] == RAJASWALA and issue["severity"] == "warning"
    assert "through its product page" in issue["message"]      # the spotlight opens it via forbvy
    [empty] = checks(result, "folder_without_courses")         # coming-soon categories are not flagged
    assert empty["folder"]["slug"] == "rajaswala" and "Rajaswala Paricharya carries the tag" in empty["message"]


def test_paid_invites_on_an_unconfigured_gateway_are_errors():
    result = audit_site_data(load_fixture(), bv_inventory(), admin_base=ADMIN)
    flagged = checks(result, "invite_vendor_unconfigured")
    assert len(flagged) == 10                                  # "10 invites still pointed at Stripe"
    assert all(i["severity"] == "error" and "STRIPE" in i["message"] for i in flagged)
    assert flagged[0]["link"] == f"{ADMIN}/settings?selectedTab=paymentGateways"
    # Free Stripe invites and Razorpay ones are fine; Rajaswala is not on the catalogue.
    assert "Gita Natyam" not in names(result, "invite_vendor_unconfigured")
    assert "Rajaswala Paricharya" not in names(result, "invite_vendor_unconfigured")


def test_course_tags_are_needed_first_format_and_for_filters():
    result = audit_site_data(load_fixture(), bv_inventory(), admin_base=ADMIN)
    no_format = names(result, "course_no_format")
    # Courses whose level is "default" show no format pill until tagged.
    assert "Vedic Parenting - eBook" in no_format and "Gita Natyam" in no_format
    assert "गीतायन - eBook" not in no_format                 # level eBook is a format level
    assert len(no_format) == 12
    # The FOR group finds nothing: every option's tag is on no course yet.
    empty_options = checks(result, "filter_option_empty")
    assert len(empty_options) == 4                             # once each, though the catalogue is on two pages
    assert [w["page_route"] for w in empty_options[0]["also_at"]] == ["courses"]
    # Formats nothing has yet are info only (the Figma greys them out).
    [info] = checks(result, "format_without_courses")
    assert info["severity"] == "info" and "E-learning" in info["message"]


def test_after_the_proposed_tags_the_format_and_for_issues_clear():
    changes = {  # bv/data_changes.json add_tags, abbreviated to what the checks need
        GITA_NATYAM: ["format-video", "shastra", "gita", "hindi"],
        "cd3c4d85-634a-468c-a85d-db5513477134": ["format-elearning", "for-womens-health"],
        "7c12a9ec-22c3-4c55-ada1-2a93e107816f": ["format-ebook", "for-parents"],
        "84218ef2-1fb8-4d7d-9893-93a710d14871": ["format-elearning", "for-students"],
        "27445cf9-8906-402f-b13c-066910bb62a1": ["format-ebook", "for-teachers"],
    }
    inv = bv_inventory()
    for c in inv["courses"]:
        add = changes.get(c["id"])
        if add:
            c["tags"] += add
            c["format_detected"] = [t[len("format-"):] for t in add if t.startswith("format-")]
            c["language_detected"] = c["language_detected"] or ["hi"]
    result = audit_site_data(load_fixture(), inv, admin_base=ADMIN)
    assert not checks(result, "course_no_stream") and not checks(result, "filter_option_empty")
    assert "Gita Natyam" not in names(result, "course_no_format")


def test_authored_prices_that_went_stale_are_flagged():
    site = load_fixture()
    clean = audit_site_data(site, bv_inventory(), admin_base=ADMIN)
    assert not checks(clean, "authored_price_stale") and not checks(clean, "authored_price")
    stale = copy.deepcopy(site)
    for page in stale["pages"]:
        for comp in page["components"]:
            for sec in comp.get("props", {}).get("columnSections") or []:
                for slide in sec.get("slides") or []:
                    slide["cta"]["price"] = "₹251"                     # the Figma's number
                    slide["steps"][1]["meta"] = "₹251"
    result = audit_site_data(stale, bv_inventory(), admin_base=ADMIN)
    [first, *_] = checks(result, "authored_price_stale")
    assert "1001" in first["message"] and first["where"]["path"].endswith(".cta.price")
    assert checks(result, "authored_price")[0]["where"]["path"].endswith(".steps[1].meta")


def test_a_path_that_does_not_exist_and_a_step_with_no_link():
    site = copy.deepcopy(load_fixture())
    site["pages"][2]["components"][1]["props"]["featured"]["code"] = "holistic-parenting"
    result = audit_site_data(site, bv_inventory(), admin_base=ADMIN)
    missing = checks(result, "unknown_product_page")
    assert [i["where"]["path"] for i in missing] == ["props.featured.code"]
    assert missing[0]["severity"] == "error"
    [unlinked] = checks(result, "step_without_link")               # "The 'Rajaswala survey' step has no link"
    assert "'Rajaswala survey'" in unlinked["message"] and unlinked["severity"] == "info"


def test_a_popular_chip_that_opens_an_empty_category():
    clean = audit_site_data(load_fixture(), bv_inventory(), admin_base=ADMIN)
    assert not checks(clean, "popular_chip_empty") and not checks(clean, "popular_chip_broken")
    inv = bv_inventory()
    for c in inv["courses"]:
        if c["id"] == GITAYAN:                       # the Gita category holds only गीतायन
            c["tags"] = ["hindi", "shastra"]
    result = audit_site_data(load_fixture(), inv, admin_base=ADMIN)
    chips = checks(result, "popular_chip_empty")
    assert {i["where"]["path"] for i in chips} == {"props.hero.popular[1]"}
    assert "Bhagwadgeeta" in chips[0]["message"]


def test_version_groups_that_mix_languages_wrongly():
    site = copy.deepcopy(load_fixture())
    groups = site["globalSettings"]["courseLanguages"]["versionGroups"]
    groups.append(["2dbf6c16-c7ff-4172-8013-69d3ace62d4c", "621f78e7-8d7e-4528-807e-ae4c18a99fb3"])  # hi + hi
    groups.append(["not-a-course"])
    result = audit_site_data(site, bv_inventory(), admin_base=ADMIN)
    assert len(checks(result, "version_group_same_language")) == 1
    assert len(checks(result, "version_group_too_small")) == 1
    assert any(i["path"].endswith("versionGroups[6]") for i in checks(result, "unknown_course"))
    clean = audit_site_data(load_fixture(), bv_inventory(), admin_base=ADMIN)
    assert not [i for i in clean["issues"] if i["check"].startswith("version_group")]


def test_unknown_library_and_foreign_course_ids_are_errors():
    site = copy.deepcopy(load_fixture())
    site["globalSettings"]["layout"]["header"]["props"]["navigation"][0]["megaMenu"]["libraryId"] = "lib-elsewhere"
    site["pages"][0]["components"][0]["props"]["columnSections"][0]["courseIds"].append("course-of-another-institute")
    result = audit_site_data(site, bv_inventory(), admin_base=ADMIN)
    assert [i["where"]["page_route"] for i in checks(result, "unknown_library")] == ["layout"]
    assert any(i["where"]["path"].endswith("courseIds[3]") for i in checks(result, "unknown_course"))


def test_the_clean_site_has_no_unknown_references_and_sorted_severities():
    result = audit_site_data(load_fixture(), bv_inventory(), admin_base=ADMIN)
    assert not [i for i in result["issues"] if i["check"].startswith("unknown_")]
    order = {"error": 0, "warning": 1, "info": 2}
    assert [order[i["severity"]] for i in result["issues"]] == sorted(order[i["severity"]] for i in result["issues"])
    assert result["summary"]["streams"] == 6 and result["library"]["id"] == LIBRARY_ID
    assert result["summary"]["error"] == 10


def test_without_a_site_course_checks_run_against_the_only_library():
    result = audit_site_data(None, bv_inventory(), admin_base=ADMIN)
    assert names(result, "course_no_stream") == ["Gita Natyam"]
    assert len(checks(result, "invite_vendor_unconfigured")) == 10
    assert not checks(result, "course_no_format")          # formats are a site setting


def test_site_invite_ids_lists_spotlight_invites():
    assert site_invite_ids(load_fixture()) == [RAJASWALA_INVITE]
    assert site_invite_ids(None) == []


# ── the actions, against a faked admin-core and database ─────────────────
def principal():
    return PinnedPrincipal(user_id="user-1", institute_id="inst-1", roles=["ADMIN"], permissions=[], is_root_user=False)


def _mapping_rows(rows):
    return [SimpleNamespace(_mapping=r) for r in rows]


class _FakeDb:
    """Answers the inventory's SQL: the institute's courses with their batches, and the invites."""
    def __init__(self):
        self.queries = []

    def execute(self, stmt, params=None):
        sql = str(stmt)
        self.queries.append((sql, params))
        if "FROM package p" in sql and "package_institute" in sql:
            assert params["inst"] == "inst-1"
            return SimpleNamespace(fetchall=lambda: _mapping_rows([
                {"id": "course-1", "name": "NEET 2027", "status": "ACTIVE", "tags": "english,format-live",
                 "published": True, "package_session_id": "ps-1", "level_name": "Class 12", "session_name": "2027"},
                {"id": "course-3", "name": "Hidden course", "status": "ACTIVE", "tags": "hindi",
                 "published": False, "package_session_id": "ps-3", "level_name": "default", "session_name": "default"},
            ]))
        if "FROM enroll_invite ei" in sql:
            assert params["inst"] == "inst-1"
            if "ei.tag = 'DEFAULT'" in sql:
                return SimpleNamespace(fetchall=lambda: _mapping_rows([
                    {"package_session_id": "ps-1", "id": "inv-1", "vendor": "STRIPE", "payment_type": "ONE_TIME",
                     "price": 45000, "currency": "INR", "tag": "DEFAULT"},
                    {"package_session_id": "ps-3", "id": "inv-3", "vendor": "RAZORPAY", "payment_type": "ONE_TIME",
                     "price": 999, "currency": "INR", "tag": "DEFAULT"},
                ]))
            return SimpleNamespace(fetchall=lambda: [])
        if "learner_portal_base_url" in sql:
            return SimpleNamespace(first=lambda: ("sites.acme.edu",))
        return SimpleNamespace(first=lambda: None, fetchall=lambda: [])

    def rollback(self):
        pass


SITE = {
    "globalSettings": {
        "courseFormats": {"live": {"label": "Live"}, "ebook": {"label": "E-books"}},
        "courseLanguages": {"enabled": True},
    },
    "pages": [{"id": "p", "route": "courses", "components": [
        {"id": "cat", "type": "courseCatalog", "props": {"streams": {"source": "folderLibrary", "libraryId": "lib-1"}}},
    ]}],
}
CATALOGUE_ROW = {"id": "cat-1", "tag_name": "main-site", "status": "ACTIVE", "is_default": True,
                 "catalogue_json": json.dumps(SITE)}
TREE = {"library": {"id": "lib-1", "institute_id": "inst-1", "name": "Streams"}, "roots": [
    {"id": "n1", "node_type": "FOLDER", "slug": "medical", "title": "Medical", "status": "ACTIVE", "children": [
        {"id": "n2", "node_type": "FOLDER", "slug": "neet", "course_tag": "NEET", "status": "ACTIVE", "children": []},
        {"id": "n3", "node_type": "PRODUCT_PAGE", "product_page_code": "NEET27", "product_page_status": "ACTIVE",
         "status": "ACTIVE", "children": []},
    ]},
]}


def fake_admin_core(calls):
    async def _call(ctx_, method, path, params=None, body=None, timeout=None):
        calls.append((method, path, params))
        if path.endswith("/course-catalogue/institute/get-all"):
            return [CATALOGUE_ROW]
        if path.endswith("/course-catalogue/institute/get/by-tag"):
            return CATALOGUE_ROW
        if path.endswith("/revision/draft"):
            return {"error": "fetch_failed", "status": 204}
        if path.endswith("/packages/v2/search"):
            return {"content": [
                {"id": "course-1", "package_name": "NEET 2027", "level_name": "Class 12", "session_name": "2027",
                 "min_plan_actual_price": 45000, "currency": "INR", "package_session_id": "ps-1",
                 "comma_separeted_tags": "english,format-live", "is_course_published_to_catalaouge": True,
                 "enroll_invite_id": "inv-1"},
                {"id": "course-2", "package_name": "Foundation", "level_name": "default", "min_plan_actual_price": 0,
                 "package_session_id": "ps-2", "comma_separeted_tags": None},
            ]}
        if path.endswith("/product-page/get-all"):
            return [{"id": "pp-1", "name": "NEET Batches", "code": "NEET27", "status": "ACTIVE", "institute_id": "inst-1",
                     "mappings": [
                         {"package_id": "course-1", "package_name": "NEET 2027", "display_order": 2, "status": "ACTIVE",
                          "level_name": "Class 12", "payment_plan": {"actual_price": 45000, "currency": "INR"}},
                         {"package_id": "course-2", "package_name": "Foundation", "display_order": 1, "status": "ACTIVE",
                          "level_name": "default", "payment_option_type": "FREE"},
                         {"package_id": "course-9", "status": "DELETED"},
                     ]}]
        if path.endswith("/folder-library/libraries"):
            assert params == {"instituteId": "inst-1"}
            return [{"id": "lib-1", "institute_id": "inst-1", "name": "Streams", "node_count": 3},
                    {"id": "lib-x", "institute_id": "inst-OTHER", "name": "Not ours"}]
        if path.endswith("/folder-library/tree"):
            assert params["instituteId"] == "inst-1" and params["libraryId"] == "lib-1"
            return TREE
        if path.endswith("/audience/campaigns"):
            return {"content": [{"id": "camp-1", "campaign_name": "Admissions", "status": "ACTIVE"}]}
        if path.endswith("/audience/leads"):
            return {"content": [], "total_elements": 0}
        raise AssertionError(f"unexpected call {method} {path}")
    return _call


@pytest.fixture
def backend(monkeypatch):
    calls = []
    monkeypatch.setattr(website_data, "_admin_core_json", fake_admin_core(calls))
    monkeypatch.setattr(website_mod, "_admin_core_json", fake_admin_core(calls))

    async def vendors(ctx_):
        return [{"vendor": "RAZORPAY", "vendor_id": "rzp"}]
    monkeypatch.setattr(course_builder_data, "payment_vendors", vendors)
    return calls


def ctx(db=None):
    return ToolContext(db=db or _FakeDb(), principal=principal(), keys=(), bearer_token="jwt")


@pytest.mark.asyncio
async def test_context_without_detail_is_unchanged(backend):
    out = json.loads(await website_mod.execute_website({"action": "context"}, ctx()))
    assert set(out) == {"action", "site", "courses", "product_pages", "lead_campaigns", "rules"}
    assert out["courses"][0] == {"id": "course-1", "name": "NEET 2027", "level": "Class 12", "session": "2027",
                                 "package_session_ids": ["ps-1"], "price": 45000, "currency": "INR"}
    assert out["product_pages"] == [{"name": "NEET Batches", "code": "NEET27", "status": "ACTIVE", "course_count": 3}]
    assert not [c for c in backend if "folder-library" in c[1]]


@pytest.mark.asyncio
async def test_context_detail_adds_course_facts_libraries_and_steps(backend):
    out = json.loads(await website_mod.execute_website({"action": "context", "detail": True}, ctx()))
    by_id = {c["id"]: c for c in out["courses"]}
    neet = by_id["course-1"]
    assert neet["tags"] == ["english", "format-live"] and neet["language_detected"] == ["en"]
    assert neet["format_detected"] == ["live"] and neet["published_to_catalogue"] is True
    assert neet["default_invite_id"] == "inv-1" and neet["vendor"] == "STRIPE" and neet["payment_type"] == "ONE_TIME"
    # Only the SQL read knows the course that is not on the catalogue; its price comes from its invite.
    hidden = by_id["course-3"]
    assert hidden["published_to_catalogue"] is False and hidden["price"] == 999 and hidden["language_detected"] == ["hi"]
    # Nothing detected = the key is absent (results drop empty values).
    assert "format_detected" not in by_id["course-2"] and by_id["course-2"]["is_free"] is True
    [page] = out["product_pages"]
    assert [s["course_name"] for s in page["steps"]] == ["Foundation", "NEET 2027"]   # display order, ACTIVE only
    assert page["steps"][1]["price"] == 45000 and "level" not in page["steps"][0]
    [lib] = out["folder_libraries"]                                # the other institute's library is dropped
    assert lib["id"] == "lib-1"
    medical = lib["roots"][0]
    assert medical["key"] == "medical" and medical["tag"] == "medical"
    assert medical["children"][0]["tag"] == "neet"                 # course_tag, lower-cased
    assert medical["children"][1]["product_page_code"] == "NEET27"


@pytest.mark.asyncio
async def test_context_detail_falls_back_to_the_catalogue_search_without_sql(backend):
    class NoSql(_FakeDb):
        def execute(self, stmt, params=None):
            if "FROM package p" in str(stmt):
                raise RuntimeError("no such table")
            return super().execute(stmt, params)
    out = json.loads(await website_mod.execute_website({"action": "context", "detail": True}, ctx(NoSql())))
    assert [c["id"] for c in out["courses"]] == ["course-1", "course-2"]
    assert all(c["published_to_catalogue"] for c in out["courses"])
    assert out["courses"][0]["default_invite_id"] == "inv-1" and "vendor" not in out["courses"][0]


@pytest.mark.asyncio
async def test_data_inventory_lists_vocabulary_levels_and_gateways(backend):
    out = json.loads(await website_mod.execute_website({"action": "data_inventory"}, ctx()))
    assert out["action"] == "data_inventory" and out["site"]["tag_name"] == "main-site"
    assert {"tag": "english", "courses": 1} in out["tag_vocabulary"]
    assert out["level_names"] == [{"level": "Class 12", "courses": 1}]
    assert out["payment_vendors"] == ["RAZORPAY"]
    assert out["lead_campaigns"] == [{"id": "camp-1", "name": "Admissions", "status": "ACTIVE"}]
    assert out["product_pages"][0]["steps"]


@pytest.mark.asyncio
async def test_data_audit_action_reports_with_links(backend):
    out = json.loads(await website_mod.execute_website({"action": "data_audit"}, ctx()))
    assert out["action"] == "data_audit" and out["checked"] == "published"
    by_check = {}
    for i in out["issues"]:
        by_check.setdefault(i["check"], []).append(i)
    # NEET 2027 is sold through Stripe; only Razorpay is configured.
    assert by_check["invite_vendor_unconfigured"][0]["course"]["id"] == "course-1"
    # Neither course carries a stream tag; Foundation carries no tag at all: no language, no format.
    assert {i["course"]["id"] for i in by_check["course_no_stream"]} == {"course-1", "course-2"}
    assert by_check["course_no_language"][0]["course"]["id"] == "course-2"
    assert by_check["course_no_format"][0]["course"]["id"] == "course-2"
    # Nothing carries the 'medical' or 'neet' tag, so that tab and its category are empty.
    assert {i["folder"]["slug"] for i in by_check["folder_without_courses"]} == {"medical", "neet"}
    assert by_check["course_not_on_catalogue"][0]["course"]["id"] == "course-3"
    assert out["editor_url"].endswith("/manage-pages/editor/main-site")


@pytest.mark.asyncio
async def test_new_actions_are_in_the_schema_and_read_only():
    actions = website_mod.WEBSITE_SCHEMA["function"]["parameters"]["properties"]["action"]["enum"]
    assert "data_inventory" in actions and "data_audit" in actions
    assert website_mod.WEBSITE_TOOLS["website"].mode == "READ"

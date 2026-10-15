package vacademy.io.admin_core_service.features.catalog_api.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriUtils;
import vacademy.io.admin_core_service.features.catalog_api.CatalogApiException;
import vacademy.io.admin_core_service.features.catalog_api.rules.*;
import vacademy.io.admin_core_service.features.catalog_api.rules.CatalogPricing.CardPriceView;
import vacademy.io.admin_core_service.features.catalog_api.rules.CatalogPricing.Kind;
import vacademy.io.admin_core_service.features.catalog_api.rules.CatalogPricing.PriceState;
import vacademy.io.admin_core_service.features.catalog_api.rules.CatalogStreams.Category;
import vacademy.io.admin_core_service.features.catalog_api.rules.CatalogStreams.FolderNode;
import vacademy.io.admin_core_service.features.catalog_api.rules.CatalogStreams.Stream;
import vacademy.io.admin_core_service.features.catalog_api.rules.CourseLanguages.Group;
import vacademy.io.admin_core_service.features.catalog_api.rules.CourseLanguages.Language;
import vacademy.io.admin_core_service.features.catalog_api.rules.LearningPaths.PathEntry;
import vacademy.io.admin_core_service.features.catalog_api.rules.LearningPaths.PathMapping;
import vacademy.io.admin_core_service.features.catalog_api.rules.LearningPaths.Step;
import vacademy.io.admin_core_service.features.course.dto.CourseDTOWithDetails;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerModuleDTOWithDetails;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerSubjectProjection;
import vacademy.io.admin_core_service.features.learner_study_library.service.LearnerOpenStudyLibraryService;
import vacademy.io.admin_core_service.features.packages.service.PackagePageContentService;
import vacademy.io.admin_core_service.features.product_page.dto.ProductPageInviteMappingResponse;
import vacademy.io.admin_core_service.features.product_page.dto.ProductPageResponse;
import vacademy.io.admin_core_service.features.study_library.dto.LevelDTOWithDetails;
import vacademy.io.admin_core_service.features.study_library.dto.SessionDTOWithDetails;
import vacademy.io.common.auth.dto.UserDTO;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * The catalogue API's read views. Every rule here is the hosted site's (see the ported classes in
 * {@code rules}); this class only decides what to show for a request and shapes the public,
 * snake_case v1 views. It never returns an internal DTO.
 */
@Slf4j
@Service
public class CatalogApiService {

    public static final int MAX_PAGE_SIZE = 100;
    static final int SUBTITLE_MAX = 300;
    static final int SEO_DESCRIPTION_MAX = 160;
    private static final int MAX_SERIES_PATHS = 12;
    static final Set<String> SORTS = Set.of("newest", "title", "price_asc", "price_desc");
    static final Set<String> AVAILABILITIES = Set.of("available", "coming_soon", "not_started", "closed");

    private final CatalogDataLoader loader;
    private final LearnerOpenStudyLibraryService openStudyLibraryService;
    private final PackagePageContentService pageContentService;

    private final Cache<String, Map<String, Object>> outlines = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofMinutes(5)).maximumSize(5_000).build();

    public CatalogApiService(CatalogDataLoader loader, LearnerOpenStudyLibraryService openStudyLibraryService,
                             PackagePageContentService pageContentService) {
        this.loader = loader;
        this.openStudyLibraryService = openStudyLibraryService;
        this.pageContentService = pageContentService;
    }

    // ── Cards ──────────────────────────────────────────────────────────────────

    /** One course as the API lists it: its versions (a language-grouped card), tags and formats. */
    record Card(Group<CatalogRow> group, int order, Set<String> tagSet, List<String> formatKeys, Instant createdAt) {
        CatalogRow primary() {
            return group.primary();
        }

        List<CatalogRow> rows() {
            return group.variants();
        }

        boolean hasPackage(String packageId) {
            for (CatalogRow r : rows()) if (packageId.equals(r.packageId())) return true;
            return false;
        }
    }

    /**
     * The institute's courses, one card per package (or per authored version group when the site
     * groups language versions), in catalogue order. Unlike the site with grouping off (one card
     * per level), a package's levels are always one card here, so a course id names one card;
     * its levels are the card's variants.
     */
    List<Card> cards(CatalogSnapshot s, String preferredLanguage) {
        SiteConfig site = s.site();
        String preferred = site.courseLanguagesOn() ? preferredLanguage : null;
        List<Group<CatalogRow>> groups = CourseLanguages.groupRows(s.rows(), true, site.languages(), preferred,
                site.grouping() ? site.versionGroups() : null);
        List<Card> out = new ArrayList<>(groups.size());
        int i = 0;
        for (Group<CatalogRow> g : groups) {
            Set<String> tagSet = new LinkedHashSet<>();
            Instant created = null;
            for (CatalogRow r : g.variants()) {
                tagSet.addAll(CourseFormats.rowTags(r.tags(), null));
                if (r.createdAt() != null && (created == null || r.createdAt().isAfter(created))) created = r.createdAt();
            }
            out.add(new Card(g, i++, tagSet, CourseFormats.cardFormatKeys(g.variants(), site.formats()), created));
        }
        return out;
    }

    private static Language languageOf(CatalogSnapshot s, CatalogRow r) {
        return CourseLanguages.languageOfRow(r, s.site().languages());
    }

    /** A site language code (lower-case) when languages are on and the code is one of them, else null. */
    private static String siteLanguage(CatalogSnapshot s, String language) {
        if (language == null || language.isBlank() || !s.site().courseLanguagesOn()) return null;
        String code = language.trim().toLowerCase(Locale.ROOT);
        for (Language l : s.site().languages()) if (l.code().equals(code)) return code;
        return code; // unknown code: filters to nothing, never silently to everything
    }

    // ── GET /site ───────────────────────────────────────────────────────────────

    public Map<String, Object> site(String instituteId) {
        CatalogSnapshot s = loader.snapshot(instituteId);
        Map<String, Object> institute = new LinkedHashMap<>();
        institute.put("id", s.instituteId());
        institute.put("name", s.instituteName());
        institute.put("logo_url", s.mediaUrl(s.instituteLogoFileId()));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("institute", institute);
        out.put("course_base_url", s.courseBaseUrl());
        out.put("languages", s.site().courseLanguagesOn() ? languageViews(s.site().languages()) : List.of());
        out.put("formats", formatViews(s, s.site().formats() == null ? List.of()
                : s.site().formats().list().stream().map(CourseFormats.Format::key).toList()));
        out.put("currency", dominantCurrency(s.rows()));
        out.put("price_visible", s.site().paymentEnabled());
        return out;
    }

    private static String dominantCurrency(List<CatalogRow> rows) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (CatalogRow r : rows) {
            if (r.currency() != null && !r.currency().isBlank()) {
                counts.merge(r.currency().trim().toUpperCase(Locale.ROOT), 1, Integer::sum);
            }
        }
        return counts.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse(null);
    }

    // ── GET /courses ────────────────────────────────────────────────────────────

    public record CourseQuery(String q, String stream, String category, String format, String language, String tag,
                              String availability, int page, int pageSize, String sort) {
    }

    public Map<String, Object> courses(String instituteId, CourseQuery query) {
        String sort = query.sort() == null || query.sort().isBlank() ? "newest" : query.sort().trim().toLowerCase(Locale.ROOT);
        if (!SORTS.contains(sort)) {
            throw invalid("sort must be one of newest, title, price_asc, price_desc.", "sort");
        }
        if (query.page() < 1) throw invalid("page starts at 1.", "page");
        if (query.pageSize() < 1 || query.pageSize() > MAX_PAGE_SIZE) {
            throw invalid("page_size must be between 1 and " + MAX_PAGE_SIZE + ".", "page_size");
        }
        String availability = blankToNull(query.availability());
        if (availability != null && !AVAILABILITIES.contains(availability.toLowerCase(Locale.ROOT))) {
            throw invalid("availability must be one of available, coming_soon, not_started, closed.", "availability");
        }

        CatalogSnapshot s = loader.snapshot(instituteId);
        String language = siteLanguage(s, query.language());
        boolean priceSort = sort.startsWith("price");
        List<Card> all = cards(s, language);

        Stream stream = null;
        if (blankToNull(query.stream()) != null) {
            stream = s.streams().stream().filter(st -> st.slug().equalsIgnoreCase(query.stream().trim())).findFirst()
                    .orElse(null);
            if (stream == null) return page(List.of(), query, 0);
        }
        List<String> categoryTags = null;
        if (blankToNull(query.category()) != null) {
            String slug = query.category().trim();
            List<Stream> scope = stream == null ? s.streams() : List.of(stream);
            Category cat = scope.stream().flatMap(st -> st.categories().stream())
                    .filter(c -> c.slug().equalsIgnoreCase(slug)).findFirst().orElse(null);
            if (cat == null) return page(List.of(), query, 0);
            categoryTags = cat.tags();
        }
        String format = blankToNull(query.format()) == null ? null : query.format().trim().toLowerCase(Locale.ROOT);
        Set<String> wantedTags = new HashSet<>();
        if (blankToNull(query.tag()) != null) {
            for (String t : query.tag().split(",")) if (!t.isBlank()) wantedTags.add(t.trim().toLowerCase(Locale.ROOT));
        }
        String q = blankToNull(query.q()) == null ? null : query.q().trim().toLowerCase(Locale.ROOT);

        record Hit(Card card, List<CatalogRow> matching, Map<String, Object> view, double sortPrice) {
        }
        List<Hit> hits = new ArrayList<>();
        for (Card card : all) {
            if (stream != null && !CatalogStreams.matchesAny(stream.tags(), card.tagSet())) continue;
            if (categoryTags != null && !CatalogStreams.matchesAny(categoryTags, card.tagSet())) continue;
            if (format != null && !card.formatKeys().contains(format)) continue;
            if (!wantedTags.isEmpty() && wantedTags.stream().noneMatch(card.tagSet()::contains)) continue;
            if (q != null && !matchesText(card, q)) continue;
            List<CatalogRow> matching = card.rows();
            if (language != null) {
                matching = card.rows().stream().filter(r -> {
                    Language l = languageOf(s, r);
                    return l != null && l.code().equals(language);
                }).toList();
                if (matching.isEmpty()) continue;
            }
            Map<String, Object> view = summary(s, card, card.primary(), matching, priceSort);
            if (availability != null && !availability.equalsIgnoreCase((String) view.get("availability"))) continue;
            hits.add(new Hit(card, matching, view, CatalogPricing.sortPrice(matching)));
        }

        Comparator<Hit> byOrder = Comparator.comparingInt(h -> h.card().order());
        Comparator<Hit> comparator = switch (sort) {
            case "title" -> Comparator.comparing((Hit h) -> h.card().primary().title(), String.CASE_INSENSITIVE_ORDER)
                    .thenComparing(byOrder);
            case "price_asc" -> Comparator.comparingDouble(Hit::sortPrice).thenComparing(byOrder);
            case "price_desc" -> Comparator.comparingDouble((Hit h) -> -h.sortPrice()).thenComparing(byOrder);
            default -> Comparator.comparing((Hit h) -> h.card().createdAt(),
                    Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(byOrder);
        };
        hits.sort(comparator);
        int from = Math.min(hits.size(), (query.page() - 1) * query.pageSize());
        int to = Math.min(hits.size(), from + query.pageSize());
        List<Map<String, Object>> data = hits.subList(from, to).stream().map(Hit::view).toList();
        return page(data, query, hits.size());
    }

    private static boolean matchesText(Card card, String q) {
        for (CatalogRow r : card.rows()) {
            if (r.title() != null && r.title().toLowerCase(Locale.ROOT).contains(q)) return true;
        }
        for (String t : card.tagSet()) if (t.contains(q)) return true;
        return false;
    }

    private static Map<String, Object> page(List<Map<String, Object>> data, CourseQuery query, int total) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("data", data);
        out.put("page", query.page());
        out.put("page_size", query.pageSize());
        out.put("total", total);
        out.put("has_more", (long) query.page() * query.pageSize() < total);
        return out;
    }

    // ── CourseSummary ───────────────────────────────────────────────────────────

    /** The CourseSummary view of a card displayed as {@code primary}, priced over {@code matching}. */
    Map<String, Object> summary(CatalogSnapshot s, Card card, CatalogRow primary, List<CatalogRow> matching,
                                boolean priceSort) {
        SiteConfig site = s.site();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", card.group().courseId());
        out.put("title", primary.title());
        out.put("subtitle", subtitleOf(site, card.rows(), primary));
        out.put("image_url", s.mediaUrl(primary.imageMediaId()));
        out.put("url", hostedUrl(s, primary.packageId(), primary.packageSessionId(), primary.enrollInviteId(),
                primary.levelName()));
        out.put("formats", formatViews(s, card.formatKeys()));
        Stream stream = CatalogStreams.streamOf(card.tagSet(), s.streams());
        Category category = CatalogStreams.categoryOf(stream, card.tagSet());
        out.put("stream", stream == null ? null : place(stream.slug(),
                CatalogStreams.placeLabel(stream.title(), stream.subtitle(), site.labelMode(), null)));
        out.put("category", category == null ? null : place(category.slug(),
                CatalogStreams.placeLabel(category.title(), category.subtitle(), site.labelMode(), null)));
        out.put("languages", site.courseLanguagesOn() ? languageViews(card.group().languages()) : List.of());
        out.put("tags", displayTags(card.rows()));
        out.put("level", levelLabel(primary.levelName()));

        CardPriceView view = CatalogPricing.cardPriceView(primary, matching);
        CatalogRow priceRow = CatalogPricing.editorialPriceRow(primary, view, matching, priceSort);
        PriceState state = primary.comingSoon() != null || priceRow == null
                ? CatalogPricing.priceStateOf(primary, site.paymentEnabled())
                : CatalogPricing.priceStateOf(priceRow, site.paymentEnabled());
        CatalogRow pricedBy = priceRow == null || primary.comingSoon() != null ? primary : priceRow;
        out.put("availability", CatalogPricing.availabilityOf(state));
        out.put("price_visible", priceVisible(state, site.paymentEnabled()));
        Map<String, Object> price = priceView(state, pricedBy);
        if (price != null) price.put("varies", view != null && view.from());
        out.put("price", price);
        out.put("instructors", primary.instructors().stream().filter(p -> p.name() != null).map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", p.name());
            m.put("image_url", s.mediaUrl(p.imageFileId()));
            return m;
        }).toList());
        out.put("rating", primary.rating() != null && primary.rating() > 0 ? primary.rating() : null);
        out.put("created_at", card.createdAt() == null ? null : card.createdAt().toString());

        List<Map<String, Object>> variants = new ArrayList<>();
        for (CatalogRow r : card.rows()) {
            PriceState vs = CatalogPricing.priceStateOf(r, site.paymentEnabled());
            Language lang = site.courseLanguagesOn() ? languageOf(s, r) : null;
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("package_session_id", r.packageSessionId());
            v.put("enroll_invite_id", r.enrollInviteId());
            v.put("level", levelLabel(r.levelName()));
            v.put("language", lang == null ? null : languageView(lang));
            v.put("url", hostedUrl(s, r.packageId(), r.packageSessionId(), r.enrollInviteId(), r.levelName()));
            v.put("availability", CatalogPricing.availabilityOf(vs));
            v.put("price", priceView(vs, r));
            variants.add(v);
        }
        out.put("variants", variants);
        return out;
    }

    /**
     * The card text ({@code descriptionOf} in catalog-card-view.ts): the authored description of
     * the displayed package, else of any of the card's packages, else the course description, else
     * its about text; plain, at most 300 characters.
     */
    static String subtitleOf(SiteConfig site, List<CatalogRow> rows, CatalogRow primary) {
        String own = site.descriptions().get(primary.packageId());
        if (own != null) return CatalogHtml.summary(own, SUBTITLE_MAX);
        for (CatalogRow r : rows) {
            String d = site.descriptions().get(r.packageId());
            if (d != null) return CatalogHtml.summary(d, SUBTITLE_MAX);
        }
        String text = CatalogHtml.plainText(primary.descriptionHtml());
        if (text == null) text = CatalogHtml.plainText(primary.aboutHtml());
        return CatalogHtml.summary(text, SUBTITLE_MAX);
    }

    private static boolean priceVisible(PriceState state, boolean paymentEnabled) {
        return switch (state.kind()) {
            case HIDDEN -> false;
            case FREE, AMOUNT -> true;
            default -> paymentEnabled;
        };
    }

    /** {amount, compare_at_amount, currency, is_free} for a free or priced state; null otherwise. */
    private static Map<String, Object> priceView(PriceState state, CatalogRow row) {
        if (state.kind() != Kind.FREE && state.kind() != Kind.AMOUNT) return null;
        Map<String, Object> p = new LinkedHashMap<>();
        double amount = state.kind() == Kind.FREE ? 0 : state.amount();
        p.put("amount", amount);
        p.put("compare_at_amount", row.elevatedPrice() != null && row.elevatedPrice() > amount ? row.elevatedPrice() : null);
        p.put("currency", row.currency());
        p.put("is_free", amount == 0);
        return p;
    }

    private static Map<String, Object> place(String slug, String label) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("slug", slug);
        m.put("label", label);
        return m;
    }

    private static List<String> displayTags(List<CatalogRow> rows) {
        LinkedHashMap<String, String> out = new LinkedHashMap<>();
        for (CatalogRow r : rows) {
            if (r.tags() == null) continue;
            for (String t : r.tags().split(",")) {
                String v = t.trim();
                if (!v.isEmpty()) out.putIfAbsent(v.toLowerCase(Locale.ROOT), v);
            }
        }
        return List.copyOf(out.values());
    }

    /** The level's name, or null for the platform's placeholder level ("default"). */
    static String levelLabel(String levelName) {
        if (levelName == null || levelName.isBlank() || "default".equalsIgnoreCase(levelName.trim())) return null;
        return levelName.trim();
    }

    private static List<Map<String, Object>> formatViews(CatalogSnapshot s, List<String> keys) {
        CourseFormats.Resolved formats = s.site().formats();
        if (formats == null) return List.of();
        List<Map<String, Object>> out = new ArrayList<>();
        for (String key : keys) {
            String label = formats.labelOf(key);
            if (label == null) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", key);
            m.put("label", label);
            out.add(m);
        }
        return out;
    }

    private static Map<String, Object> languageView(Language l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", l.code());
        m.put("label", l.label() == null || l.label().isBlank() ? l.code().toUpperCase(Locale.ROOT) : l.label());
        return m;
    }

    private static List<Map<String, Object>> languageViews(List<Language> languages) {
        return languages.stream().map(CatalogApiService::languageView).toList();
    }

    /**
     * The course's page on the hosted site: {@code <course_base_url>/<custom route ‖ package id>}
     * with CourseShowcaseComponent.openCourse's query ({@code enrollInviteId}, {@code packageSessionId},
     * {@code level}; empty ones omitted). Custom routes: {@code resolveCoursePageRoute}.
     */
    static String hostedUrl(CatalogSnapshot s, String packageId, String packageSessionId, String enrollInviteId,
                            String levelName) {
        String base = s.courseBaseUrl();
        if (base == null || packageId == null) return null;
        String route = CoursePageRouting.resolveCoursePageRoute(s.site().globalSettings(), packageId, packageSessionId);
        StringBuilder url = new StringBuilder(base);
        url.append('/').append(UriUtils.encodePathSegment(route != null ? route : packageId, StandardCharsets.UTF_8));
        char sep = '?';
        String[][] params = {{"enrollInviteId", enrollInviteId}, {"packageSessionId", packageSessionId},
                {"level", levelName}};
        for (String[] p : params) {
            if (p[1] == null || p[1].isBlank()) continue;
            url.append(sep).append(p[0]).append('=').append(UriUtils.encodeQueryParam(p[1].trim(), StandardCharsets.UTF_8));
            sep = '&';
        }
        return url.toString();
    }

    /** A site path ("/x") made absolute against the hosted site's origin; URLs pass through. */
    static String absolute(CatalogSnapshot s, String safeSrc) {
        if (safeSrc == null) return null;
        if (!safeSrc.startsWith("/")) return safeSrc;
        String base = s.courseBaseUrl();
        if (base == null) return null;
        try {
            URI uri = URI.create(base);
            return uri.getScheme() + "://" + uri.getRawAuthority() + safeSrc;
        } catch (Exception e) {
            return null;
        }
    }

    // ── GET /courses/{id} ────────────────────────────────────────────────────────

    /** The card holding package {@code id}, displayed as the requested language / package. */
    private record Found(Card card, CatalogRow primary) {
    }

    private Found find(CatalogSnapshot s, String id, String language) {
        if (id == null || id.isBlank()) throw notFound();
        String code = siteLanguage(s, language);
        for (Card card : cards(s, null)) {
            if (!card.hasPackage(id)) continue;
            CatalogRow primary = null;
            if (code != null) {
                primary = card.rows().stream().filter(r -> {
                    Language l = languageOf(s, r);
                    return l != null && l.code().equals(code);
                }).findFirst().orElse(null);
            }
            if (primary == null && !id.equals(card.group().courseId())) {
                primary = card.rows().stream().filter(r -> id.equals(r.packageId())).findFirst().orElse(null);
            }
            return new Found(card, primary == null ? card.primary() : primary);
        }
        throw notFound();
    }

    public Map<String, Object> course(String instituteId, String id, String language) {
        CatalogSnapshot s = loader.snapshot(instituteId);
        Found found = find(s, id, language);
        Card card = found.card();
        CatalogRow primary = found.primary();
        Map<String, Object> out = summary(s, card, primary, card.rows(), false);

        out.put("description_html", CatalogHtml.sanitize(primary.descriptionHtml()));
        out.put("description_text", CatalogHtml.plainText(primary.descriptionHtml()));
        out.put("about_html", CatalogHtml.sanitize(primary.aboutHtml()));
        out.put("about_text", CatalogHtml.plainText(primary.aboutHtml()));
        out.put("why_learn_html", CatalogHtml.sanitize(primary.whyLearnHtml()));
        out.put("who_should_learn_html", CatalogHtml.sanitize(primary.whoShouldLearnHtml()));

        Optional<CourseDTOWithDetails> init = loader.courseInit(instituteId, primary.packageId());
        String pageJson = init.map(i -> i.getCourse() == null ? null : i.getCourse().getCoursePageJson()).orElse(null);
        if (pageJson == null && init.isEmpty()) {
            try {
                pageJson = pageContentService.getContentJson(primary.packageId());
            } catch (Exception e) {
                log.debug("catalog-api: page content unreadable for {}: {}", primary.packageId(), e.getMessage());
            }
        }
        CoursePageContent.Content content = CoursePageContent.parseCoursePageJson(pageJson);
        out.put("mode", content.mode() == null ? null : content.mode().toLowerCase(Locale.ROOT));
        out.put("faqs", content.faqs().stream().map(f -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("question", f.q());
            m.put("answer_html", CatalogHtml.sanitize(f.a()));
            return m;
        }).toList());
        out.put("preview_video", previewVideoView(primary.courseMediaId()));

        List<CatalogRow.Person> authors = authorsOf(init.orElse(null), primary);
        Map<String, String> authorPics = loader.resolveMedia(authors.stream().map(CatalogRow.Person::imageFileId)
                .filter(Objects::nonNull).toList());
        out.put("authors", authors.stream().map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", a.name());
            m.put("subtitle", a.subtitle());
            m.put("bio_html", CatalogHtml.sanitize(a.bioHtml()));
            m.put("image_url", a.imageFileId() == null ? null : authorPics.get(a.imageFileId()));
            return m;
        }).toList());
        out.put("series", seriesOf(s, card, primary));

        String url = (String) out.get("url");
        String description = (String) out.get("subtitle");
        if (description == null) description = CatalogHtml.summary(CatalogHtml.plainText(primary.aboutHtml()), SEO_DESCRIPTION_MAX);
        String seoDescription = CatalogHtml.summary(description, SEO_DESCRIPTION_MAX);
        Map<String, Object> seo = new LinkedHashMap<>();
        seo.put("title", primary.title());
        seo.put("description", seoDescription);
        seo.put("image_url", out.get("image_url"));
        // The bare page address: the enrolment query only picks a version, and one canonical per
        // course keeps search engines from treating each version link as a separate page.
        seo.put("canonical_url", withoutQuery(url));
        out.put("seo", seo);
        out.put("structured_data", structuredData(s, out, primary, seoDescription));
        return out;
    }

    static String withoutQuery(String url) {
        if (url == null) return null;
        int q = url.indexOf('?');
        return q < 0 ? url : url.substring(0, q);
    }

    private Map<String, Object> previewVideoView(String courseMediaId) {
        CoursePageContent.PreviewVideo video = CoursePageContent.previewVideoOf(courseMediaId);
        if (video == null) return null;
        Map<String, Object> m = new LinkedHashMap<>();
        switch (video.kind()) {
            case "youtube", "vimeo" -> {
                m.put("kind", video.kind());
                m.put("id", video.id());
                m.put("embed_url", CoursePageContent.embedUrlOf(video));
            }
            case "url" -> {
                m.put("kind", "url");
                m.put("url", video.url());
                m.put("embed_url", null);
            }
            default -> { // a media-service file: its public URL
                String url = loader.resolveMedia(List.of(video.id())).get(video.id());
                if (url == null) return null;
                m.put("kind", "url");
                m.put("url", url);
                m.put("embed_url", null);
            }
        }
        return m;
    }

    /**
     * The course page's authors: course-init's instructors of the displayed version's level (its
     * session and level), else of any level, else the catalogue row's instructors. Never an email.
     */
    static List<CatalogRow.Person> authorsOf(CourseDTOWithDetails init, CatalogRow primary) {
        List<UserDTO> chosen = null;
        List<UserDTO> any = new ArrayList<>();
        if (init != null && init.getSessions() != null) {
            for (SessionDTOWithDetails session : init.getSessions()) {
                if (session == null || session.getLevelWithDetails() == null) continue;
                boolean sameSession = session.getSessionDTO() != null && primary.sessionId() != null
                        && primary.sessionId().equals(session.getSessionDTO().getId());
                for (LevelDTOWithDetails level : session.getLevelWithDetails()) {
                    if (level == null || level.getInstructors() == null) continue;
                    any.addAll(level.getInstructors());
                    boolean sameLevel = (primary.levelId() != null && primary.levelId().equals(level.getId()))
                            || (primary.levelName() != null && level.getName() != null
                            && primary.levelName().trim().equalsIgnoreCase(level.getName().trim()));
                    if (sameSession && sameLevel && chosen == null && !level.getInstructors().isEmpty()) {
                        chosen = level.getInstructors();
                    }
                }
            }
        }
        List<UserDTO> users = chosen != null ? chosen : any;
        if (users.isEmpty()) return primary.instructors().stream().filter(p -> p.name() != null).toList();
        Map<String, CatalogRow.Person> unique = new LinkedHashMap<>();
        for (UserDTO u : users) {
            if (u == null) continue;
            String name = u.getFullName() == null ? null : u.getFullName().trim();
            if (name == null || name.isEmpty()) continue;
            String key = u.getId() != null ? u.getId() : name;
            unique.putIfAbsent(key, new CatalogRow.Person(u.getId(), name, blankToNull(u.getProfilePicFileId()),
                    blankToNull(u.getAuthorSubtitle()), u.getAuthorDescription()));
        }
        return List.copyOf(unique.values());
    }

    private static Map<String, Object> structuredData(CatalogSnapshot s, Map<String, Object> view, CatalogRow primary,
                                                      String description) {
        Map<String, Object> ld = new LinkedHashMap<>();
        ld.put("@context", "https://schema.org");
        ld.put("@type", "Course");
        ld.put("name", primary.title());
        ld.put("description", description != null ? description : primary.title());
        if (view.get("image_url") != null) ld.put("image", view.get("image_url"));
        if (view.get("url") != null) ld.put("url", withoutQuery((String) view.get("url")));
        Language lang = s.site().courseLanguagesOn() ? languageOf(s, primary) : null;
        if (lang != null) ld.put("inLanguage", lang.code());
        Map<String, Object> provider = new LinkedHashMap<>();
        provider.put("@type", "Organization");
        provider.put("name", s.instituteName());
        String sameAs = blankToNull(s.instituteWebsiteUrl());
        if (sameAs == null) sameAs = absolute(s, "/");
        if (sameAs != null) provider.put("sameAs", sameAs);
        ld.put("provider", provider);
        @SuppressWarnings("unchecked")
        Map<String, Object> price = (Map<String, Object>) view.get("price");
        if (price != null) {
            Map<String, Object> offer = new LinkedHashMap<>();
            offer.put("@type", "Offer");
            offer.put("price", price.get("amount"));
            if (price.get("currency") != null) offer.put("priceCurrency", price.get("currency"));
            offer.put("category", Boolean.TRUE.equals(price.get("is_free")) ? "Free" : "Paid");
            if (view.get("url") != null) offer.put("url", view.get("url"));
            offer.put("availability", switch (String.valueOf(view.get("availability"))) {
                case "available" -> "https://schema.org/InStock";
                case "coming_soon", "not_started" -> "https://schema.org/PreOrder";
                default -> "https://schema.org/Discontinued";
            });
            ld.put("offers", List.of(offer));
        }
        Map<String, Object> instance = new LinkedHashMap<>();
        instance.put("@type", "CourseInstance");
        instance.put("courseMode", "online");
        ld.put("hasCourseInstance", List.of(instance));
        return ld;
    }

    /**
     * The learning path the course is a step of ({@code useCourseSeries}): the paths in the
     * course's stream first, then the rest (at most 12); the first that lists the course wins; a
     * path of fewer than two steps is no series.
     */
    Map<String, Object> seriesOf(CatalogSnapshot s, Card card, CatalogRow primary) {
        String libraryId = s.site().pathLibraryId();
        if (libraryId == null) return null;
        List<FolderNode> roots = loader.folderTree(s.instituteId(), libraryId).orElse(List.of());
        if (roots.isEmpty()) return null;
        Stream stream = CatalogStreams.streamOf(card.tagSet(), s.streams());
        FolderNode folder = stream == null ? null : LearningPaths.findFolderBySlug(roots, stream.slug());
        List<PathEntry> inStream = folder == null ? List.of()
                : LearningPaths.collectPathEntries(folder.children(), folder, new HashSet<>());
        Set<String> inStreamCodes = inStream.stream().map(PathEntry::code).collect(Collectors.toSet());
        List<PathEntry> entries = new ArrayList<>(inStream);
        for (PathEntry e : LearningPaths.collectPathEntries(roots)) if (!inStreamCodes.contains(e.code())) entries.add(e);
        if (entries.size() > MAX_SERIES_PATHS) entries = entries.subList(0, MAX_SERIES_PATHS);
        String courseId = primary.packageId();
        for (PathEntry entry : entries) {
            List<PathMapping> mappings = mappingsOf(loader.productPage(s.instituteId(), entry.code()).orElse(null));
            boolean listed = mappings.stream().anyMatch(m -> courseId.equals(m.packageId())
                    && "ACTIVE".equalsIgnoreCase(m.status() == null ? "ACTIVE" : m.status()));
            if (!listed) continue;
            List<Step> steps = LearningPaths.buildPathSteps(mappings, s.site().courseLanguagesOn(),
                    s.site().languages(), null);
            if (steps.size() < 2) return null;
            List<Map<String, Object>> stepViews = new ArrayList<>();
            for (Step step : steps) {
                PathMapping m = step.primary();
                Map<String, Object> v = new LinkedHashMap<>();
                v.put("course_id", step.courseId());
                v.put("title", m.packageName() == null ? "" : m.packageName().trim());
                v.put("url", hostedUrl(s, m.packageId(), m.packageSessionId(), m.enrollInviteId(), m.levelName()));
                v.put("current", step.courseId().equals(courseId) || card.hasPackage(step.courseId()));
                stepViews.add(v);
            }
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("name", CatalogStreams.nodeTitle(entry.node()));
            out.put("steps", stepViews);
            return out;
        }
        return null;
    }

    static List<PathMapping> mappingsOf(ProductPageResponse page) {
        if (page == null || page.getMappings() == null) return List.of();
        List<PathMapping> out = new ArrayList<>();
        for (ProductPageInviteMappingResponse m : page.getMappings()) {
            if (m == null) continue;
            var plan = m.getPaymentPlan();
            out.add(new PathMapping(m.getPackageId(), m.getPackageSessionId(), m.getLevelName(), m.getPackageName(),
                    m.getStatus(), m.getEnrollInviteId(),
                    plan == null ? null : plan.getActualPrice(),
                    plan == null ? null : plan.getElevatedPrice(),
                    plan != null && plan.getCurrency() != null ? plan.getCurrency() : page.getCurrency(),
                    m.getTags(), m.getCoursePreviewImageMediaId()));
        }
        return out;
    }

    // ── GET /courses/{id}/outline ────────────────────────────────────────────────

    public Map<String, Object> outline(String instituteId, String id, String language) {
        CatalogSnapshot s = loader.snapshot(instituteId);
        Found found = find(s, id, null);
        String code = siteLanguage(s, language);
        List<CatalogRow> rows = found.card().rows();
        if (code != null) {
            List<CatalogRow> inLanguage = rows.stream().filter(r -> {
                Language l = languageOf(s, r);
                return l != null && l.code().equals(code);
            }).toList();
            if (!inLanguage.isEmpty()) rows = inLanguage;
        }
        final List<CatalogRow> levels = rows;
        String key = instituteId + "|" + found.card().group().courseId() + "|" + (code == null ? "" : code);
        return outlines.get(key, k -> buildOutline(levels));
    }

    private Map<String, Object> buildOutline(List<CatalogRow> rows) {
        List<Map<String, Object>> levels = new ArrayList<>();
        for (CatalogRow r : rows) {
            if (r.packageSessionId() == null) continue;
            List<Map<String, Object>> subjects = new ArrayList<>();
            List<LearnerSubjectProjection> subjectRows =
                    new ArrayList<>(openStudyLibraryService.getSubjectsByPackageSessionId(r.packageSessionId()));
            subjectRows.sort(Comparator.comparing(LearnerSubjectProjection::getSubjectOrder,
                    Comparator.nullsLast(Comparator.naturalOrder())));
            for (LearnerSubjectProjection subject : subjectRows) {
                List<Map<String, Object>> modules = new ArrayList<>();
                List<LearnerModuleDTOWithDetails> moduleRows = new ArrayList<>(
                        openStudyLibraryService.getModulesDetailsWithChapters(subject.getId(), r.packageSessionId()));
                moduleRows.sort(Comparator.comparing(LearnerModuleDTOWithDetails::getModuleOrder,
                        Comparator.nullsLast(Comparator.naturalOrder())));
                for (LearnerModuleDTOWithDetails module : moduleRows) {
                    if (module == null || module.getModule() == null) continue;
                    List<Map<String, Object>> chapters = new ArrayList<>();
                    if (module.getChapters() != null) {
                        module.getChapters().stream()
                                .filter(c -> c != null && !Boolean.TRUE.equals(c.getIsHidden()))
                                .forEach(c -> chapters.add(named(c.getId(), c.getChapterName())));
                    }
                    Map<String, Object> m = named(module.getModule().getId(), module.getModule().getModuleName());
                    m.put("chapters", chapters);
                    modules.add(m);
                }
                Map<String, Object> sv = named(subject.getId(), subject.getSubjectName());
                sv.put("modules", modules);
                subjects.add(sv);
            }
            Map<String, Object> level = new LinkedHashMap<>();
            level.put("package_session_id", r.packageSessionId());
            level.put("level", levelLabel(r.levelName()));
            level.put("subjects", subjects);
            levels.add(level);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("levels", levels);
        return out;
    }

    private static Map<String, Object> named(String id, String name) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("name", name);
        return m;
    }

    // ── GET /streams ────────────────────────────────────────────────────────────

    public Map<String, Object> streams(String instituteId) {
        CatalogSnapshot s = loader.snapshot(instituteId);
        List<Set<String>> tagSets = cards(s, null).stream().map(Card::tagSet).toList();
        List<Map<String, Object>> streams = new ArrayList<>();
        for (Stream st : s.streams()) {
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("slug", st.slug());
            v.put("label", st.title());
            v.put("subtitle", blankToNull(st.subtitle()));
            v.put("image_url", absolute(s, st.imageUrl()));
            v.put("accent_color", st.accentColor());
            v.put("coming_soon", st.comingSoon());
            v.put("course_count", count(st.tags(), tagSets));
            List<Map<String, Object>> categories = new ArrayList<>();
            for (Category c : st.categories()) {
                Map<String, Object> cv = new LinkedHashMap<>();
                cv.put("slug", c.slug());
                cv.put("label", c.title());
                cv.put("subtitle", blankToNull(c.subtitle()));
                cv.put("image_url", absolute(s, c.imageUrl()));
                cv.put("coming_soon", c.comingSoon());
                cv.put("course_count", count(c.tags(), tagSets));
                categories.add(cv);
            }
            v.put("categories", categories);
            streams.add(v);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("source", s.streamsSource());
        out.put("streams", streams);
        return out;
    }

    private static int count(List<String> tags, List<Set<String>> tagSets) {
        int n = 0;
        for (Set<String> card : tagSets) if (CatalogStreams.matchesAny(tags, card)) n++;
        return n;
    }

    // ── GET /learning-paths ─────────────────────────────────────────────────────

    public Map<String, Object> learningPaths(String instituteId, String stream) {
        CatalogSnapshot s = loader.snapshot(instituteId);
        List<Map<String, Object>> data = new ArrayList<>();
        String libraryId = s.site().pathLibraryId();
        if (libraryId != null) {
            List<FolderNode> roots = loader.folderTree(instituteId, libraryId).orElse(List.of());
            for (PathEntry entry : LearningPaths.pathsInScope(roots, blankToNull(stream))) {
                List<PathMapping> mappings = mappingsOf(loader.productPage(instituteId, entry.code()).orElse(null));
                List<Step> steps = LearningPaths.buildPathSteps(mappings, s.site().courseLanguagesOn(),
                        s.site().languages(), null);
                List<FolderNode> trail = CatalogStreams.pathTo(roots, entry.node().id());
                FolderNode top = trail.isEmpty() ? null : trail.get(0);
                Map<String, Object> v = new LinkedHashMap<>();
                v.put("code", entry.code());
                v.put("name", CatalogStreams.nodeTitle(entry.node()));
                v.put("stream_slug", top != null && top.isFolder() ? CatalogStreams.folderSlug(top) : null);
                v.put("image_url", absolute(s, CatalogStreams.safeImageSrc(entry.node().imageUrl())));
                v.put("step_count", steps.size());
                data.add(v);
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("data", data);
        return out;
    }

    public Map<String, Object> learningPath(String instituteId, String code) {
        CatalogSnapshot s = loader.snapshot(instituteId);
        String libraryId = s.site().pathLibraryId();
        if (libraryId == null || code == null || code.isBlank()) throw notFound("Learning path");
        List<FolderNode> roots = loader.folderTree(instituteId, libraryId).orElse(List.of());
        PathEntry entry = LearningPaths.collectPathEntries(roots).stream()
                .filter(e -> e.code().equals(code.trim())).findFirst().orElse(null);
        if (entry == null) throw notFound("Learning path");
        ProductPageResponse page = loader.productPage(instituteId, entry.code()).orElse(null);
        if (page == null) throw notFound("Learning path");
        List<Step> steps = LearningPaths.buildPathSteps(mappingsOf(page), s.site().courseLanguagesOn(),
                s.site().languages(), null);

        List<Card> cards = cards(s, null);
        Set<String> missingImages = new LinkedHashSet<>();
        for (Step step : steps) {
            if (cardOf(cards, step.primary().packageId()) == null && step.primary().imageMediaId() != null) {
                missingImages.add(step.primary().imageMediaId());
            }
        }
        Map<String, String> images = missingImages.isEmpty() ? Map.of() : loader.resolveMedia(missingImages);

        List<Map<String, Object>> stepViews = new ArrayList<>();
        int position = 1;
        for (Step step : steps) {
            Card card = cardOf(cards, step.primary().packageId());
            Map<String, Object> course;
            if (card != null) {
                CatalogRow primary = card.rows().stream()
                        .filter(r -> Objects.equals(r.packageSessionId(), step.primary().packageSessionId()))
                        .findFirst().orElse(card.primary());
                course = summary(s, card, primary, card.rows(), false);
            } else {
                course = mappingSummary(s, step, images);
            }
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("position", position++);
            v.put("course", course);
            stepViews.add(v);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("code", entry.code());
        String name = CatalogStreams.nodeTitle(entry.node());
        out.put("name", name.isEmpty() ? page.getName() : name);
        out.put("description_html", CatalogHtml.sanitize(entry.node().description()));
        out.put("steps", stepViews);
        return out;
    }

    private static Card cardOf(List<Card> cards, String packageId) {
        if (packageId == null) return null;
        for (Card c : cards) if (c.hasPackage(packageId)) return c;
        return null;
    }

    /**
     * A path step whose course is not in the catalogue (not published to it): the summary the
     * path's own product-page mapping can give — its price is the mapping's payment plan.
     */
    private Map<String, Object> mappingSummary(CatalogSnapshot s, Step step, Map<String, String> images) {
        SiteConfig site = s.site();
        PathMapping primary = step.primary();
        Set<String> tagSet = new LinkedHashSet<>();
        for (PathMapping m : step.variants()) tagSet.addAll(CourseFormats.rowTags(m.tags(), null));
        List<String> formatKeys = new ArrayList<>();
        for (PathMapping m : step.variants()) {
            for (String k : CourseFormats.courseFormatKeys(m.tags(), m.levelName(), site.formats())) {
                if (!formatKeys.contains(k)) formatKeys.add(k);
            }
        }
        Stream stream = CatalogStreams.streamOf(tagSet, s.streams());
        Category category = CatalogStreams.categoryOf(stream, tagSet);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", step.courseId());
        out.put("title", primary.packageName());
        out.put("subtitle", null);
        out.put("image_url", primary.imageMediaId() == null ? null : images.get(primary.imageMediaId()));
        out.put("url", hostedUrl(s, primary.packageId(), primary.packageSessionId(), primary.enrollInviteId(),
                primary.levelName()));
        out.put("formats", formatViews(s, formatKeys));
        out.put("stream", stream == null ? null : place(stream.slug(),
                CatalogStreams.placeLabel(stream.title(), stream.subtitle(), site.labelMode(), null)));
        out.put("category", category == null ? null : place(category.slug(),
                CatalogStreams.placeLabel(category.title(), category.subtitle(), site.labelMode(), null)));
        out.put("languages", site.courseLanguagesOn() ? languageViews(step.languages()) : List.of());
        LinkedHashMap<String, String> tags = new LinkedHashMap<>();
        for (PathMapping m : step.variants()) {
            if (m.tags() == null) continue;
            for (String t : m.tags().split(",")) if (!t.isBlank()) tags.putIfAbsent(t.trim().toLowerCase(Locale.ROOT), t.trim());
        }
        out.put("tags", List.copyOf(tags.values()));
        out.put("level", levelLabel(primary.levelName()));
        out.put("availability", "available");
        Map<String, Object> price = mappingPrice(primary, site.paymentEnabled());
        out.put("price_visible", price != null || site.paymentEnabled());
        if (price != null) {
            Set<Double> prices = step.variants().stream().map(PathMapping::price).filter(Objects::nonNull)
                    .collect(Collectors.toSet());
            price.put("varies", prices.size() > 1);
        }
        out.put("price", price);
        out.put("instructors", List.of());
        out.put("rating", null);
        out.put("created_at", null);
        List<Map<String, Object>> variants = new ArrayList<>();
        for (PathMapping m : step.variants()) {
            Language lang = site.courseLanguagesOn()
                    ? CourseLanguages.languageOfRow(m.levelName(), m.tags(), site.languages()) : null;
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("package_session_id", m.packageSessionId());
            v.put("enroll_invite_id", m.enrollInviteId());
            v.put("level", levelLabel(m.levelName()));
            v.put("language", lang == null ? null : languageView(lang));
            v.put("url", hostedUrl(s, m.packageId(), m.packageSessionId(), m.enrollInviteId(), m.levelName()));
            v.put("availability", "available");
            v.put("price", mappingPrice(m, site.paymentEnabled()));
            variants.add(v);
        }
        out.put("variants", variants);
        return out;
    }

    private static Map<String, Object> mappingPrice(PathMapping m, boolean paymentEnabled) {
        if (m.price() == null) return null;
        double amount = Math.max(0, m.price());
        if (amount > 0 && !paymentEnabled) return null;
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("amount", amount);
        p.put("compare_at_amount", m.elevatedPrice() != null && m.elevatedPrice() > amount ? m.elevatedPrice() : null);
        p.put("currency", m.currency());
        p.put("is_free", amount == 0);
        return p;
    }

    // ── GET /sitemap ────────────────────────────────────────────────────────────

    public Map<String, Object> sitemap(String instituteId) {
        CatalogSnapshot s = loader.snapshot(instituteId);
        List<Map<String, Object>> data = new ArrayList<>();
        for (Card card : cards(s, null)) {
            CatalogRow p = card.primary();
            String url = hostedUrl(s, p.packageId(), p.packageSessionId(), p.enrollInviteId(), p.levelName());
            if (url == null) continue;
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("url", url);
            v.put("type", "course");
            v.put("id", card.group().courseId());
            v.put("lastmod", card.createdAt() == null ? null : card.createdAt().toString());
            data.add(v);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("data", data);
        return out;
    }

    /** Whether package {@code id} is a published catalogue course of the institute. */
    public boolean isCatalogueCourse(String instituteId, String id) {
        if (id == null || id.isBlank()) return false;
        for (CatalogRow r : loader.snapshot(instituteId).rows()) if (id.equals(r.packageId())) return true;
        return false;
    }

    // ── errors ──────────────────────────────────────────────────────────────────

    static CatalogApiException invalid(String message, String param) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("param", param);
        return new CatalogApiException(HttpStatus.BAD_REQUEST, "invalid_request", message, details, null);
    }

    static CatalogApiException notFound() {
        return notFound("Course");
    }

    static CatalogApiException notFound(String what) {
        return new CatalogApiException(HttpStatus.NOT_FOUND, "not_found", what + " not found.");
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}

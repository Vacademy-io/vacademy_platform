package vacademy.io.community_service.feature.onboarding.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.community_service.feature.onboarding.dto.*;
import vacademy.io.community_service.feature.onboarding.entity.OnboardingLink;
import vacademy.io.community_service.feature.onboarding.enums.OnboardingLinkType;
import vacademy.io.community_service.feature.onboarding.repository.OnboardingLinkRepository;

import java.util.*;
import java.util.stream.Collectors;

/** CRUD for shareable links + resolving the public form config a link renders. */
@Service
@Slf4j
public class OnboardingLinkService {

    @Autowired
    private OnboardingLinkRepository repository;
    @Autowired
    private QuestionCatalog catalog;
    @Autowired
    private OnboardingJson json;

    @Value("${ONBOARDING_PUBLIC_BASE_URL:https://health.vacademy.io}")
    private String publicBaseUrl;

    // ---- public form resolution --------------------------------------------------

    public PublicLinkConfigDto resolvePublicConfig(String slug) {
        OnboardingLink link = repository.findBySlug(slug)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Link not found"));

        boolean expired = link.getExpiresAt() != null && link.getExpiresAt().before(new Date());

        Map<String, Object> prefilled = json.readMap(link.getPrefilledValues());
        Set<String> prefilledKeys = prefilled == null ? Set.of() : prefilled.keySet();
        boolean forced = StringUtils.hasText(link.getForcedInstituteType());

        List<QuestionDto> questions = new ArrayList<>();
        if (!OnboardingLinkType.DIRECT_DEMO.name().equals(link.getLinkType())) {
            List<String> visibleKeys = json.readList(link.getVisibleQuestionKeys());
            boolean showAll = visibleKeys == null || visibleKeys.isEmpty();
            Set<String> visibleSet = showAll ? null : new HashSet<>(visibleKeys);

            for (QuestionDto q : catalog.all()) {
                if (!showAll && !visibleSet.contains(q.getKey())) continue;
                if (prefilledKeys.contains(q.getKey())) continue;           // known → hidden
                if (forced && q.isDrivesDemo()) continue;                   // type already decided
                questions.add(q);
            }
        }

        return PublicLinkConfigDto.builder()
                .slug(link.getSlug())
                .linkType(link.getLinkType())
                .introHeading(link.getIntroHeading())
                .introSubheading(link.getIntroSubheading())
                .active(link.isActive() && !expired)
                .expired(expired)
                .forcedInstituteType(link.getForcedInstituteType())
                .instituteTypes(catalog.instituteTypeOptions())
                .questions(questions)
                .prefilled(prefilled)
                .build();
    }

    // ---- super-admin CRUD --------------------------------------------------------

    public List<OnboardingLinkDto> listAll() {
        return repository.findAllByOrderByCreatedAtDesc().stream().map(this::toDto).collect(Collectors.toList());
    }

    public OnboardingLinkDto create(UpsertLinkRequest req, String userId) {
        String type = normalizeType(req.getLinkType());
        OnboardingLink link = OnboardingLink.builder()
                .slug(resolveSlug(req.getSlug(), req.getName()))
                .name(StringUtils.hasText(req.getName()) ? req.getName() : "Untitled link")
                .linkType(type)
                .visibleQuestionKeys(json.write(req.getVisibleQuestionKeys()))
                .prefilledValues(json.write(req.getPrefilledValues()))
                .forcedInstituteType(emptyToNull(req.getForcedInstituteType()))
                .introHeading(req.getIntroHeading())
                .introSubheading(req.getIntroSubheading())
                .active(req.getActive() == null || req.getActive())
                .expiresAt(req.getExpiresAt())
                .createdByUserId(userId)
                .build();
        return toDto(repository.save(link));
    }

    public OnboardingLinkDto update(String id, UpsertLinkRequest req) {
        OnboardingLink link = repository.findById(id)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Link not found"));
        if (req.getName() != null) link.setName(req.getName());
        if (req.getLinkType() != null) link.setLinkType(normalizeType(req.getLinkType()));
        if (req.getVisibleQuestionKeys() != null) link.setVisibleQuestionKeys(json.write(req.getVisibleQuestionKeys()));
        if (req.getPrefilledValues() != null) link.setPrefilledValues(json.write(req.getPrefilledValues()));
        if (req.getForcedInstituteType() != null) link.setForcedInstituteType(emptyToNull(req.getForcedInstituteType()));
        if (req.getIntroHeading() != null) link.setIntroHeading(req.getIntroHeading());
        if (req.getIntroSubheading() != null) link.setIntroSubheading(req.getIntroSubheading());
        if (req.getActive() != null) link.setActive(req.getActive());
        if (req.getExpiresAt() != null) link.setExpiresAt(req.getExpiresAt());
        return toDto(repository.save(link));
    }

    public void delete(String id) {
        repository.deleteById(id);
    }

    // ---- helpers -----------------------------------------------------------------

    public OnboardingLinkDto toDto(OnboardingLink link) {
        return OnboardingLinkDto.builder()
                .id(link.getId())
                .slug(link.getSlug())
                .name(link.getName())
                .linkType(link.getLinkType())
                .visibleQuestionKeys(json.readList(link.getVisibleQuestionKeys()))
                .prefilledValues(json.readMap(link.getPrefilledValues()))
                .forcedInstituteType(link.getForcedInstituteType())
                .introHeading(link.getIntroHeading())
                .introSubheading(link.getIntroSubheading())
                .active(link.isActive())
                .expiresAt(link.getExpiresAt())
                .submissionCount(link.getSubmissionCount())
                .createdAt(link.getCreatedAt())
                .shareUrl(shareUrl(link))
                .build();
    }

    private String shareUrl(OnboardingLink link) {
        String base = publicBaseUrl.endsWith("/") ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1) : publicBaseUrl;
        String path = OnboardingLinkType.DIRECT_DEMO.name().equals(link.getLinkType()) ? "/demo/" : "/onboarding/";
        return base + path + link.getSlug();
    }

    private String normalizeType(String type) {
        if (!StringUtils.hasText(type)) {
            return OnboardingLinkType.GENERAL.name();
        }
        try {
            return OnboardingLinkType.valueOf(type.toUpperCase()).name();
        } catch (IllegalArgumentException e) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "Unknown link type: " + type);
        }
    }

    private String resolveSlug(String requested, String name) {
        String candidate = slugify(StringUtils.hasText(requested) ? requested : name);
        if (!StringUtils.hasText(candidate)) {
            candidate = "link";
        }
        String slug = candidate;
        int guard = 0;
        while (repository.existsBySlug(slug)) {
            slug = candidate + "-" + UUID.randomUUID().toString().substring(0, 6);
            if (++guard > 5) {
                slug = candidate + "-" + UUID.randomUUID();
                break;
            }
        }
        return slug;
    }

    private String slugify(String input) {
        if (!StringUtils.hasText(input)) {
            return "";
        }
        String s = input.toLowerCase().trim()
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("[\\s-]+", "-")
                .replaceAll("^-|-$", "");
        return s.length() > 80 ? s.substring(0, 80) : s;
    }

    private static String emptyToNull(String v) {
        return (v == null || v.isBlank()) ? null : v.trim().toUpperCase();
    }
}

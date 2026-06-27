package vacademy.io.community_service.feature.onboarding.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.community_service.feature.onboarding.dto.*;
import vacademy.io.community_service.feature.onboarding.entity.OnboardingLink;
import vacademy.io.community_service.feature.onboarding.entity.OnboardingSubmission;
import vacademy.io.community_service.feature.onboarding.enums.InstituteType;
import vacademy.io.community_service.feature.onboarding.enums.SubmissionStatus;
import vacademy.io.community_service.feature.onboarding.repository.OnboardingLinkRepository;
import vacademy.io.community_service.feature.onboarding.repository.OnboardingSubmissionRepository;

import java.util.*;
import java.util.stream.Collectors;

/** Persists public submissions, routes them to a demo, fires alerts, and powers the super-admin inbox. */
@Service
@Slf4j
public class OnboardingSubmissionService {

    @Autowired
    private OnboardingSubmissionRepository repository;
    @Autowired
    private OnboardingLinkRepository linkRepository;
    @Autowired
    private DemoAccountService demoAccountService;
    @Autowired
    private OnboardingRecipientService recipientService;
    @Autowired
    private OnboardingAlertService alertService;
    @Autowired
    private QuestionCatalog catalog;
    @Autowired
    private OnboardingJson json;

    // ---- public submit -----------------------------------------------------------

    public SubmitResponseDto submit(SubmitRequestDto req) {
        String slug = StringUtils.hasText(req.getSlug()) ? req.getSlug() : "general";
        OnboardingLink link = linkRepository.findBySlug(slug)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Link not found"));
        if (!link.isActive()) {
            throw new VacademyException(HttpStatus.GONE, "This link is no longer active");
        }
        if (link.getExpiresAt() != null && link.getExpiresAt().before(new Date())) {
            throw new VacademyException(HttpStatus.GONE, "This link has expired");
        }

        // Merge known (prefilled) answers under the prospect's answers.
        Map<String, Object> answers = new LinkedHashMap<>();
        Map<String, Object> prefilled = json.readMap(link.getPrefilledValues());
        if (prefilled != null) answers.putAll(prefilled);
        if (req.getAnswers() != null) answers.putAll(req.getAnswers());

        String instituteType = resolveInstituteType(link, answers, req.getInstituteType());
        DemoHandoffDto handoff = demoAccountService.buildHandoff(instituteType);

        OnboardingSubmission submission = OnboardingSubmission.builder()
                .linkId(link.getId())
                .linkSlug(link.getSlug())
                .linkType(link.getLinkType())
                .contactName(str(answers.get("full_name")))
                .contactEmail(str(answers.get("work_email")))
                .contactPhone(str(answers.get("phone")))
                .organizationName(str(answers.get("organization_name")))
                .role(str(answers.get("role")))
                .instituteType(instituteType)
                .source(str(answers.get("referral_source")))
                .featuresOfInterest(json.write(computeFeatures(answers)))
                .answers(json.write(answers))
                .demoInstituteId(handoff.getInstituteId())
                .status(SubmissionStatus.NEW.name())
                .referrer(req.getReferrer())
                .build();
        submission = repository.save(submission);

        // bump the link's counter
        link.setSubmissionCount(link.getSubmissionCount() + 1);
        linkRepository.save(link);

        // notify the team (best-effort)
        boolean emailed = alertService.onNewSubmission(submission, answers,
                handoff.getDisplayName(), recipientService.activeEmails());
        if (emailed) {
            submission.setEmailSent(true);
            repository.save(submission);
        }

        return SubmitResponseDto.builder()
                .submissionId(submission.getId())
                .handoff(handoff)
                .build();
    }

    private String resolveInstituteType(OnboardingLink link, Map<String, Object> answers, String fromRequest) {
        String type = StringUtils.hasText(link.getForcedInstituteType()) ? link.getForcedInstituteType()
                : firstNonBlank(str(answers.get("institute_type")), fromRequest);
        if (!StringUtils.hasText(type)) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "Institute type is required to pick a demo");
        }
        type = type.toUpperCase();
        try {
            InstituteType.valueOf(type);
        } catch (IllegalArgumentException e) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "Unknown institute type: " + type);
        }
        // keep the canonical value in the answer map too
        answers.put("institute_type", type);
        return type;
    }

    /** A feature is "of interest" when its flagged question has a truthy / non-empty answer. */
    private List<String> computeFeatures(Map<String, Object> answers) {
        List<String> features = new ArrayList<>();
        catalog.all().forEach(q -> {
            if (q.getFeatureFlag() == null) return;
            if (isTruthy(answers.get(q.getKey()))) {
                features.add(q.getFeatureFlag());
            }
        });
        return features;
    }

    private boolean isTruthy(Object v) {
        if (v == null) return false;
        if (v instanceof Boolean b) return b;
        if (v instanceof Collection<?> c) return !c.isEmpty();
        String s = String.valueOf(v).trim();
        return !s.isEmpty() && !s.equalsIgnoreCase("false") && !s.equalsIgnoreCase("no");
    }

    // ---- super-admin inbox -------------------------------------------------------

    public PageResponseDto<SubmissionDto> search(String status, String instituteType, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100));
        Page<OnboardingSubmission> result = repository.search(
                emptyToNull(status), emptyToNull(instituteType), pageable);
        return PageResponseDto.<SubmissionDto>builder()
                .content(result.getContent().stream().map(this::toDto).collect(Collectors.toList()))
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .build();
    }

    public SubmissionDto getById(String id) {
        OnboardingSubmission s = repository.findById(id)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Submission not found"));
        // first open marks it viewed
        if (SubmissionStatus.NEW.name().equals(s.getStatus())) {
            s.setStatus(SubmissionStatus.VIEWED.name());
            repository.save(s);
        }
        return toDto(s);
    }

    public SubmissionDto updateStatus(String id, String status) {
        OnboardingSubmission s = repository.findById(id)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Submission not found"));
        try {
            s.setStatus(SubmissionStatus.valueOf(status.toUpperCase()).name());
        } catch (Exception e) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "Unknown status: " + status);
        }
        return toDto(repository.save(s));
    }

    public Map<String, Long> counts() {
        Map<String, Long> m = new LinkedHashMap<>();
        m.put("total", repository.count());
        for (SubmissionStatus st : SubmissionStatus.values()) {
            m.put(st.name(), repository.countByStatus(st.name()));
        }
        return m;
    }

    private SubmissionDto toDto(OnboardingSubmission s) {
        return SubmissionDto.builder()
                .id(s.getId())
                .linkSlug(s.getLinkSlug())
                .linkType(s.getLinkType())
                .contactName(s.getContactName())
                .contactEmail(s.getContactEmail())
                .contactPhone(s.getContactPhone())
                .organizationName(s.getOrganizationName())
                .role(s.getRole())
                .instituteType(s.getInstituteType())
                .instituteTypeLabel(label(s.getInstituteType()))
                .source(s.getSource())
                .featuresOfInterest(json.readList(s.getFeaturesOfInterest()))
                .answers(json.readMap(s.getAnswers()))
                .demoInstituteId(s.getDemoInstituteId())
                .status(s.getStatus())
                .emailSent(s.isEmailSent())
                .referrer(s.getReferrer())
                .createdAt(s.getCreatedAt())
                .build();
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private static String firstNonBlank(String a, String b) {
        return StringUtils.hasText(a) ? a : b;
    }

    private static String emptyToNull(String v) {
        return StringUtils.hasText(v) ? v : null;
    }

    private static String label(String type) {
        try {
            return InstituteType.valueOf(type).getLabel();
        } catch (Exception e) {
            return type;
        }
    }
}

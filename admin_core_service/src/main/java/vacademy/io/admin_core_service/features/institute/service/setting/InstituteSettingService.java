package vacademy.io.admin_core_service.features.institute.service.setting;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itextpdf.styledxmlparser.jsoup.Jsoup;
import com.itextpdf.styledxmlparser.jsoup.nodes.Document;
import com.itextpdf.styledxmlparser.jsoup.nodes.Entities;
import com.itextpdf.styledxmlparser.jsoup.nodes.Element;
import com.itextpdf.styledxmlparser.jsoup.select.Elements;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.common.entity.CustomFields;
import vacademy.io.admin_core_service.features.common.entity.InstituteCustomField;
import vacademy.io.admin_core_service.features.common.service.InstituteCustomFiledService;
import vacademy.io.admin_core_service.features.institute.constants.ConstantsSettingDefaultValue;
import vacademy.io.admin_core_service.features.institute.dto.CertificationGenerationRequest;
import vacademy.io.admin_core_service.features.institute.dto.settings.InstituteSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.SettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.certificate.CertificateSettingDataDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.certificate.CertificateSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.certificate.CertificateSettingRequest;
import vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldSettingRequest;
import vacademy.io.admin_core_service.features.institute.dto.settings.GenericSettingRequest;
import vacademy.io.admin_core_service.features.institute.dto.settings.naming.NameSettingRequest;
import vacademy.io.admin_core_service.features.institute.enums.CertificateTypeEnum;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.certificate.entity.IssuedCertificate;
import vacademy.io.admin_core_service.features.certificate.repository.IssuedCertificateRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.core.utils.DateUtil;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.common.media.dto.InMemoryMultipartFile;
import vacademy.io.common.media.service.FileService;

import java.io.ByteArrayOutputStream;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

@Slf4j
@Service
public class InstituteSettingService {

    private final SettingStrategyFactory settingStrategyFactory;
    private final InstituteRepository instituteRepository;
    private final ObjectMapper objectMapper;
    private final MediaService mediaService;
    private final AuthService authService;
    private final InstituteCustomFiledService instituteCustomFiledService;
    private final IssuedCertificateRepository issuedCertificateRepository;

    // Default minimum completion percentage for issuing a certificate when an
    // institute has not configured one.
    private static final int DEFAULT_AUTO_ISSUE_PERCENTAGE = 80;

    public InstituteSettingService(InstituteRepository instituteRepository, ObjectMapper objectMapper,
            FileService fileService, MediaService mediaService, AuthService authService,
            InstituteCustomFiledService instituteCustomFiledService, SettingStrategyFactory settingStrategyFactory,
            IssuedCertificateRepository issuedCertificateRepository) {
        this.instituteRepository = instituteRepository;
        this.objectMapper = objectMapper;
        this.mediaService = mediaService;
        this.authService = authService;
        this.instituteCustomFiledService = instituteCustomFiledService;
        this.settingStrategyFactory = settingStrategyFactory;
        this.issuedCertificateRepository = issuedCertificateRepository;
    }

    public void createNewNamingSetting(Institute institute, NameSettingRequest request) {
        String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute, request,
                SettingKeyEnums.NAMING_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    public void createNewCertificateSetting(Institute institute, CertificateSettingStrategy request) {
        String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute, request,
                SettingKeyEnums.CERTIFICATE_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    @Transactional
    public void updateCertificateSetting(Institute institute, CertificateSettingRequest request) {
        String settingJsonString = settingStrategyFactory.rebuildOldSettingAndGetSettingJsonString(institute, request,
                SettingKeyEnums.CERTIFICATE_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);

        // Issued certificates are immutable: editing the template must NOT change
        // a certificate a learner has already been issued. We therefore do NOT
        // clear learners' cached certificate file ids here. Learners who already
        // have a certificate (automated_completion_certificate_file_id set) keep
        // it; only learners not yet issued (null file id) render against this
        // freshly-saved template the next time they cross the completion
        // threshold. See getCurrentCertificateTemplate (always returns the
        // current saved template) and the file-id guard in
        // InstituteCertificateManager.generateAutomatedCourseCompletionCertificate
        // (renders once, then serves the cached file thereafter).
    }

    public void createDefaultCertificateSetting(Institute institute) {
        CertificateSettingRequest request = new CertificateSettingRequest();
        CertificateSettingDto settingDto = new CertificateSettingDto();

        Map<String, String> placeHolderValueMapping = new HashMap<>();
        placeHolderValueMapping.put("6", "Official Signatory");
        placeHolderValueMapping.put("7", "");

        settingDto.setKey(CertificateTypeEnum.COURSE_COMPLETION.name());
        settingDto.setIsDefaultCertificateSettingOn(false);
        settingDto.setDefaultHtmlCertificateTemplate(
                ConstantsSettingDefaultValue.getDefaultHtmlForType(CertificateTypeEnum.COURSE_COMPLETION.name()));
        settingDto.setCurrentHtmlCertificateTemplate(
                ConstantsSettingDefaultValue.getDefaultHtmlForType(CertificateTypeEnum.COURSE_COMPLETION.name()));
        settingDto.setPlaceHoldersMapping(placeHolderValueMapping);

        Map<String, CertificateSettingDto> settingDtoMap = new HashMap<>();
        settingDtoMap.put(CertificateTypeEnum.COURSE_COMPLETION.name(), settingDto);
        request.setRequest(settingDtoMap);

        String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute, request,
                SettingKeyEnums.CERTIFICATE_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    public void createDefaultSettingsForInstitute(Institute institute) {
        try {
            createDefaultNamingSetting(institute, ConstantsSettingDefaultValue.getDefaultNamingSettingRequest());
        } catch (Exception e) {
            log.error("Error Occurred in Creating Default Setting: " + e.getMessage());
        }

        try {
            createDefaultCertificateSetting(institute);
        } catch (Exception e) {
            log.error("Error Occurred in Creating Default Certificate Setting: " + e.getMessage());
        }

        try {
            createDefaultCustomFieldSetting(institute);
        } catch (Exception e) {
            log.error("Error Occurred in Creating Default Custom Field Setting: " + e.getMessage());
        }

        try {
            createDefaultInvoiceSetting(institute);
        } catch (Exception e) {
            log.error("Error creating default invoice setting: " + e.getMessage());
        }

        try {
            createDefaultOnboardingSetting(institute);
        } catch (Exception e) {
            log.error("Error creating default onboarding setting: " + e.getMessage());
        }
        // Doubt notification templates: a single global default row lives at institute_id =
        // 'DEFAULT' (see V215). New institutes fall back to it automatically via
        // DoubtNotificationService.resolveTemplateId — no per-institute seeding needed.
    }

    /**
     * Adds INVOICE_SETTING key-value to institute settings if not already present.
     * Default: sendInvoiceEmail=false, plus tax/currency defaults. Does not
     * overwrite existing.
     */
    public void createDefaultInvoiceSetting(Institute institute) {
        if (getSpecificSetting(institute, "INVOICE_SETTING") != null) {
            return;
        }
        Map<String, Object> defaultData = new HashMap<>();
        defaultData.put("taxIncluded", false);
        defaultData.put("taxRate", 0.0);
        defaultData.put("taxLabel", "Tax");
        defaultData.put("currency", "INR");
        defaultData.put("sendInvoiceEmail", false);
        // Admin copy: when sendAdminCopy is true, the admins in adminCopyUserIds also
        // receive the invoice / payment-confirmation emails (see InvoiceAdminCopyRecipientResolver).
        defaultData.put("sendAdminCopy", false);
        defaultData.put("adminCopyUserIds", new ArrayList<>());
        // Country + tax components: the operating country, the institute's own tax
        // registration number (e.g. GSTIN/VAT no.) and a list of named tax components
        // (label + rate). These are injectable into invoice templates via the
        // {{country}}, {{tax_registration_number}} and {{tax_components}} placeholders.
        Map<String, Object> country = new HashMap<>();
        country.put("code", "");
        country.put("name", "");
        country.put("taxRegistrationNumber", "");
        // HSN/SAC code (SAC for services such as courses). Injectable via {{hsn_code}}.
        country.put("hsnSacCode", "");
        country.put("taxComponents", new ArrayList<>());
        defaultData.put("country", country);
        GenericSettingRequest request = GenericSettingRequest.builder()
                .settingName("Invoice Setting")
                .settingData(defaultData)
                .build();
        createNewGenericSetting(institute, "INVOICE_SETTING", request);
    }

    /**
     * Adds ONBOARDING_SETTING key-value to institute settings if not already present.
     * Default is disabled (enabled=false) -- with the setting off, none of the onboarding
     * feature's UI or auto-start behavior is active and the institute behaves exactly as
     * it did before the feature existed. Does not overwrite an existing value.
     */
    public void createDefaultOnboardingSetting(Institute institute) {
        if (getSpecificSetting(institute, "ONBOARDING_SETTING") != null) {
            return;
        }
        Map<String, Object> defaultData = new HashMap<>();
        defaultData.put("enabled", false);
        GenericSettingRequest request = GenericSettingRequest.builder()
                .settingName("Onboarding Setting")
                .settingData(defaultData)
                .build();
        createNewGenericSetting(institute, "ONBOARDING_SETTING", request);
    }

    @Transactional
    public void createDefaultCustomFieldSetting(Institute institute) {
        try {
            List<InstituteCustomField> defaultCustomFields = instituteCustomFiledService
                    .createDefaultCustomFieldsForInstitute(institute);

            CustomFieldSettingRequest request = new CustomFieldSettingRequest();

            List<CustomFieldDto> customFieldsAndGroups = createFieldsAndGroupsForInstitute(defaultCustomFields);

            request.setFixedCustomFields(customFieldsAndGroups.stream().map(CustomFieldDto::getCustomFieldId).toList());
            request.setAllCustomFields(customFieldsAndGroups.stream().map(CustomFieldDto::getCustomFieldId).toList());
            request.setCustomFieldLocations(ConstantsSettingDefaultValue.getDefaultCustomFieldLocations());
            request.setCustomFieldsAndGroups(customFieldsAndGroups);
            request.setFixedFieldRenameDtos(ConstantsSettingDefaultValue.getFixedColumnsRenameDto());
            request.setCustomGroup(new HashMap<>());

            List<String> compulsoryCustomFields = new ArrayList<>();
            List<String> customFieldsName = new ArrayList<>();

            customFieldsAndGroups.forEach(field -> {
                customFieldsName.add(field.getFieldName());
                compulsoryCustomFields.add(field.getCustomFieldId());
            });
            request.setCompulsoryCustomFields(compulsoryCustomFields);
            request.setCustomFieldsName(customFieldsName);

            String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute, request,
                    SettingKeyEnums.CUSTOM_FIELD_SETTING.name());
            institute.setSetting(settingJsonString);
            instituteRepository.save(institute);
        } catch (Exception e) {
            throw new VacademyException("Failed to create default setting: " + e.getMessage());
        }
    }

    private List<CustomFieldDto> createFieldsAndGroupsForInstitute(List<InstituteCustomField> defaultCustomFields) {
        List<CustomFieldDto> response = new ArrayList<>();
        AtomicReference<Integer> order = new AtomicReference<>(1);
        defaultCustomFields.forEach(instituteCustomField -> {
            Optional<CustomFields> customFields = instituteCustomFiledService
                    .getCustomFieldById(instituteCustomField.getCustomFieldId());

            customFields.ifPresent(fields -> response.add(CustomFieldDto.builder()
                    .instituteId(instituteCustomField.getInstituteId())
                    .id(instituteCustomField.getId())
                    .customFieldId(instituteCustomField.getCustomFieldId())
                    .fieldType(fields.getFieldType())
                    .fieldName(fields.getFieldName())
                    .locations(isCompulsory(fields.getFieldName())
                            ? ConstantsSettingDefaultValue.getDefaultCustomFieldLocations()
                            : new ArrayList<>())
                    .individualOrder(order.getAndSet(order.get() + 1))
                    .status("ACTIVE")
                    .canBeDeleted(false)
                    .canBeEdited(false)
                    .canBeRenamed(false).build()));
        });

        return response;
    }

    private boolean isCompulsory(String field) {
        return true;
    }

    public void updateCustomFieldSetting(Institute institute, CustomFieldSettingRequest request) {
        String settingJsonString = settingStrategyFactory.rebuildOldSettingAndGetSettingJsonString(institute, request,
                SettingKeyEnums.CUSTOM_FIELD_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    public void updateNamingSetting(Institute institute, NameSettingRequest request) {
        String settingJsonString = settingStrategyFactory.rebuildOldSettingAndGetSettingJsonString(institute, request,
                SettingKeyEnums.NAMING_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    public void createDefaultNamingSetting(Institute institute, NameSettingRequest request) {
        String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute, request,
                SettingKeyEnums.NAMING_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    // Generic methods for any setting type
    public void createNewGenericSetting(Institute institute, String settingKey, Object settingData) {
        String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute, settingData,
                settingKey);
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    public void updateGenericSetting(Institute institute, String settingKey, Object settingData) {
        String settingJsonString = settingStrategyFactory.rebuildOldSettingAndGetSettingJsonString(institute,
                settingData, settingKey);
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    // Upsert method - creates if doesn't exist, updates if exists
    public void saveGenericSetting(Institute institute, String settingKey, Object settingData) {
        String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute, settingData,
                settingKey);
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    // GET methods for retrieving settings
    public InstituteSettingDto getAllSettings(Institute institute) {
        String settingJsonString = institute.getSetting();
        if (Objects.isNull(settingJsonString)) {
            return InstituteSettingDto.builder()
                    .instituteId(institute.getId())
                    .setting(Map.of())
                    .build();
        }

        try {
            ObjectMapper objectMapper = new ObjectMapper();
            return objectMapper.readValue(settingJsonString, InstituteSettingDto.class);
        } catch (Exception e) {
            throw new VacademyException("Error parsing settings: " + e.getMessage());
        }
    }

    public SettingDto getSpecificSetting(Institute institute, String settingKey) {
        InstituteSettingDto allSettings = getAllSettings(institute);

        if (allSettings.getSetting() == null || !allSettings.getSetting().containsKey(settingKey)) {
            return null;
        }

        return allSettings.getSetting().get(settingKey);
    }

    public Object getSettingData(Institute institute, String settingKey) {
        SettingDto setting = getSpecificSetting(institute, settingKey);
        if (setting == null) {
            return null;
        }
        return setting.getData();
    }

    public String getSettingsAsRawJson(Institute institute) {
        return institute.getSetting();
    }

    public Optional<FileDetailsDTO> ifEligibleForCourseCertificationForUserAndPackageSession(String learnerId,
            String packageSessionId, String instituteId,
            Optional<StudentSessionInstituteGroupMapping> instituteStudentMapping,
            CertificationGenerationRequest request) {
        if (instituteStudentMapping.isEmpty())
            return Optional.empty();
        if (instituteStudentMapping.get().getInstitute() == null)
            return Optional.empty();

        String setting = instituteStudentMapping.get().getInstitute().getSetting();
        if (!StringUtils.hasText(setting))
            return Optional.empty();

        // Server-side threshold gate. The frontend computes percentage_completed
        // and forwards it on the request; we re-validate against the institute's
        // configured auto_issue_percentage so the gate isn't bypassable.
        int autoIssuePercentage = getAutoIssuePercentage(setting, CertificateTypeEnum.COURSE_COMPLETION.name());
        Integer reported = request != null ? request.getCompletionPercentage() : null;
        if (reported == null || reported < autoIssuePercentage) {
            return Optional.empty();
        }

        Map<String, String> placeHoldersValueMapping = extractPlaceholders(setting);

        Optional<String> currentHtmlCertificateTemplate = getCurrentCertificateTemplate(setting,
                CertificateTypeEnum.COURSE_COMPLETION.name());
        return currentHtmlCertificateTemplate.flatMap(s -> createCertificateUrlFromTemplateAndLearnerData(s,
                instituteStudentMapping.get(), placeHoldersValueMapping, request, setting));

    }

    /**
     * Builds a human-readable certificate id of the form
     * {@code XX-NNNN-YYYY} where {@code XX} is the first two alphanumeric
     * letters of the institute name, {@code NNNN} is a 4-digit random number,
     * and {@code YYYY} is the current year. Retries on collision using the
     * audit table as the uniqueness oracle.
     */
    /**
     * Self-heal: ensure an {@link IssuedCertificate} audit row exists for a
     * (user, packageSession) pair whose certificate has already been generated
     * and cached on the {@code StudentSessionInstituteGroupMapping}. Older
     * issuances pre-date the audit table, so they have a {@code file_id} on
     * the mapping but no row here. The manager calls this on the cached path
     * to backfill those rows the first time the cert URL is fetched after
     * deploy. Fresh issuances continue to insert via the normal render path.
     *
     * <p>Backfilled rows have {@code template_html_snapshot = null} and
     * {@code completion_percentage = null} because that data is irrecoverable.
     * Best-effort: failures are logged and swallowed — never block delivery.
     */
    public void backfillIssuedCertificateIfMissing(StudentSessionInstituteGroupMapping mapping,
                                                   String fileId, String courseName) {
        try {
            if (mapping == null || !StringUtils.hasText(fileId)) return;
            String packageSessionId = mapping.getPackageSession() != null
                    ? mapping.getPackageSession().getId() : null;
            if (packageSessionId == null) return;
            if (issuedCertificateRepository
                    .findFirstByUserIdAndPackageSessionIdOrderByIssuedAtDesc(
                            mapping.getUserId(), packageSessionId).isPresent()) {
                return; // already have an audit row
            }
            // Generate once and write to *both* `id` (PK) and `certificate_id`
            // (self-documenting column) so the two stay 1:1.
            String backfilledCertId = generateUniqueCertificateId(mapping.getInstitute());
            IssuedCertificate audit = IssuedCertificate.builder()
                    .id(backfilledCertId)
                    .certificateId(backfilledCertId)
                    .instituteId(mapping.getInstitute() != null ? mapping.getInstitute().getId() : null)
                    .userId(mapping.getUserId())
                    .packageSessionId(packageSessionId)
                    .courseName(courseName)
                    .completionPercentage(null)
                    .issuedAt(new Date())
                    .fileId(fileId)
                    .templateHtmlSnapshot(null)
                    .build();
            issuedCertificateRepository.save(audit);
            log.info("Backfilled IssuedCertificate row for user {} session {}",
                    mapping.getUserId(), packageSessionId);
        } catch (Exception e) {
            log.error("Failed to backfill IssuedCertificate for user {}: {}",
                    mapping != null ? mapping.getUserId() : "?", e.getMessage());
        }
    }

    private String generateUniqueCertificateId(Institute institute) {
        String prefix = "XX";
        if (institute != null && StringUtils.hasText(institute.getInstituteName())) {
            String letters = institute.getInstituteName().replaceAll("[^A-Za-z0-9]", "").toUpperCase();
            if (letters.length() >= 2) prefix = letters.substring(0, 2);
            else if (letters.length() == 1) prefix = letters + "X";
        }
        int year = Calendar.getInstance().get(Calendar.YEAR);
        Random random = new Random();
        // 4 digits gives 10k slots/year/institute; if collisions exhaust retries
        // we widen to 6 digits as a last resort to guarantee progress.
        for (int attempt = 0; attempt < 50; attempt++) {
            int n = random.nextInt(10000);
            String candidate = String.format("%s-%04d-%d", prefix, n, year);
            if (!issuedCertificateRepository.existsById(candidate)) {
                return candidate;
            }
        }
        long n = (long) (Math.random() * 1_000_000L);
        return String.format("%s-%06d-%d", prefix, n, year);
    }

    /**
     * Appends a fixed bottom-right badge displaying the certificate id to the
     * rendered HTML. Uses {@code position: fixed} so OpenHTML2PDF repeats it on
     * every page if the certificate spans multiple pages.
     */
    private String appendCertificateIdBadge(String html, String certificateId) {
        String badge = "<div style=\"position:fixed;bottom:8mm;right:10mm;"
                + "font-family:Arial,sans-serif;font-size:10px;color:#444;"
                + "background:rgba(255,255,255,0.85);padding:3px 8px;"
                + "border:1px solid #d0d7de;border-radius:4px;letter-spacing:0.5px;\">"
                + "Certificate ID: " + certificateId + "</div>";
        int closing = html.lastIndexOf("</body>");
        if (closing >= 0) {
            return html.substring(0, closing) + badge + html.substring(closing);
        }
        // No body tag (partial HTML) — just append; convertHtmlToPdf will wrap it.
        return html + badge;
    }

    /**
     * Reads auto_issue_percentage from the certificate setting JSON for the given
     * key. Falls back to DEFAULT_AUTO_ISSUE_PERCENTAGE if missing or unparseable
     * — keeps existing institutes that haven't saved this field functioning.
     */
    private int getAutoIssuePercentage(String settingJson, String key) {
        try {
            JsonNode root = objectMapper.readTree(settingJson);
            JsonNode certificateSettings = root.path("setting").path("CERTIFICATE_SETTING").path("data").path("data");
            if (certificateSettings.isArray()) {
                for (JsonNode certificateConfig : certificateSettings) {
                    if (key.equals(certificateConfig.path("key").asText(null))) {
                        JsonNode pct = certificateConfig.path("autoIssuePercentage");
                        if (!pct.isMissingNode() && !pct.isNull() && pct.isInt()) {
                            return pct.asInt();
                        }
                    }
                }
            }
        } catch (Exception ignored) {
            // fall through to default
        }
        return DEFAULT_AUTO_ISSUE_PERCENTAGE;
    }

    /**
     * Reads aspect_ratio (and optional custom dimensions) from certificate
     * settings. Returns null when absent so the renderer applies its historical
     * A4 landscape default.
     */
    private float[] getPageSizeMm(String settingJson, String key) {
        try {
            JsonNode root = objectMapper.readTree(settingJson);
            JsonNode certificateSettings = root.path("setting").path("CERTIFICATE_SETTING").path("data").path("data");
            if (certificateSettings.isArray()) {
                for (JsonNode certificateConfig : certificateSettings) {
                    if (key.equals(certificateConfig.path("key").asText(null))) {
                        String aspect = certificateConfig.path("aspectRatio").asText(null);
                        if (aspect == null) return null;
                        switch (aspect) {
                            case "A4_PORTRAIT":  return new float[]{210f, 297f};
                            case "A3_LANDSCAPE": return new float[]{420f, 297f};
                            case "A3_PORTRAIT":  return new float[]{297f, 420f};
                            case "CUSTOM":
                                int w = certificateConfig.path("customWidthMm").asInt(297);
                                int h = certificateConfig.path("customHeightMm").asInt(210);
                                return new float[]{w, h};
                            case "A4_LANDSCAPE":
                            default:             return new float[]{297f, 210f};
                        }
                    }
                }
            }
        } catch (Exception ignored) {
            // fall through
        }
        return null;
    }

    private Optional<FileDetailsDTO> createCertificateUrlFromTemplateAndLearnerData(
            String template,
            StudentSessionInstituteGroupMapping studentSessionInstituteGroupMapping,
            Map<String, String> placeHoldersValueMapping, CertificationGenerationRequest request,
            String settingJson) {

        // Your mapping (placeholder key -> actual value)
        Map<String, String> placeHolderMapping = new HashMap<>();
        String studentId = studentSessionInstituteGroupMapping.getUserId();
        // Pull the full user record once — we need fullName for {{STUDENT_NAME}}
        // *and* email/mobile for the contact-detail tokens. Guarded so a missing
        // user (deleted account, auth service hiccup) downgrades to empty
        // strings rather than NPE-ing through the rest of the render.
        UserDTO learner = null;
        try {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(studentId));
            if (users != null && !users.isEmpty()) {
                learner = users.get(0);
            }
        } catch (Exception ignored) {
            // fall through with learner = null
        }
        String learnerName = learner != null ? learner.getFullName() : "";
        String learnerEmail = learner != null ? learner.getEmail() : "";
        String learnerMobile = learner != null ? learner.getMobileNumber() : "";
        String enrollmentNumber =
                Optional.ofNullable(studentSessionInstituteGroupMapping.getInstituteEnrolledNumber())
                        .orElse("");

        String instituteImageUrl = mediaService
                .getFileUrlById(studentSessionInstituteGroupMapping.getInstitute().getLogoFileId());

        // Resolve a course/package display name. Prefer the value the frontend
        // forwarded (already localized); fall back to package metadata.
        String courseName = request != null && StringUtils.hasText(request.getCourseName())
                ? request.getCourseName()
                : Optional.ofNullable(studentSessionInstituteGroupMapping.getPackageSession())
                        .map(ps -> ps.getPackageEntity())
                        .map(PackageEntity::getPackageName)
                        .orElse("");

        // Generate the certificate id up front so it can be embedded in the HTML
        // *and* persisted to the audit table with the same value. Format is
        // {INSTITUTE_PREFIX}-{4-DIGIT}-{YEAR} (e.g. "IS-0123-2026"); uniqueness
        // is enforced by checking the audit table before commit.
        String certificateId = generateUniqueCertificateId(
                studentSessionInstituteGroupMapping.getInstitute());

        placeHolderMapping.put("1",
                studentSessionInstituteGroupMapping.getPackageSession().getSession().getSessionName());
        placeHolderMapping.put("2", studentSessionInstituteGroupMapping.getPackageSession().getLevel().getLevelName());
        placeHolderMapping.put("3", learnerName);
        placeHolderMapping.put("4", DateUtil.convertDateToString(request.getCompletionDate()));
        placeHolderMapping.put("5", instituteImageUrl);
        placeHolderMapping.put("6", placeHoldersValueMapping.get("6"));
        placeHolderMapping.put("7", placeHoldersValueMapping.get("7"));
        placeHolderMapping.put("8", studentSessionInstituteGroupMapping.getInstitute().getInstituteName());
        placeHolderMapping.put("9", DateUtil.convertDateToString(new Date()));

        // Your default placeholders
        Map<String, String> defaultPlaceHolders = ConstantsSettingDefaultValue.getDefaultPlaceHolders();

        String filledTemplate = template;

        // Named placeholders introduced by the new certificate UX. These run
        // FIRST so the correct values land before the legacy numeric pass —
        // the legacy map has a historical bug where it points "1" at
        // {{COURSE_NAME}} but stores the session name there, which mangles
        // {{COURSE_NAME}} into the session name on every render. Running the
        // named pass first claims the correct tokens; the legacy pass only
        // fills in tokens the named pass didn't already consume.
        Map<String, String> namedPlaceholders = new HashMap<>();
        namedPlaceholders.put("{{CERTIFICATE_ID}}", certificateId);
        namedPlaceholders.put("{{COURSE_NAME}}", courseName);
        namedPlaceholders.put("{{PACKAGE_NAME}}", courseName);
        namedPlaceholders.put("{{PACKAGE_LEVEL}}",
                Optional.ofNullable(studentSessionInstituteGroupMapping.getPackageSession())
                        .map(ps -> ps.getLevel())
                        .map(l -> l.getLevelName()).orElse(""));
        namedPlaceholders.put("{{SESSION_NAME}}",
                Optional.ofNullable(studentSessionInstituteGroupMapping.getPackageSession())
                        .map(ps -> ps.getSession())
                        .map(s -> s.getSessionName()).orElse(""));
        namedPlaceholders.put("{{INSTITUTE_NAME}}",
                studentSessionInstituteGroupMapping.getInstitute().getInstituteName());
        namedPlaceholders.put("{{STUDENT_NAME}}", learnerName);
        namedPlaceholders.put("{{COMPLETION_PERCENTAGE}}",
                request != null && request.getCompletionPercentage() != null
                        ? request.getCompletionPercentage().toString()
                        : "");
        // `date_of_completion` replaces the legacy `issue_date` field. Both
        // tokens substitute to the same value (the learner's completion date,
        // falling back to today) so saved templates from before the rename
        // continue to render the right value without re-saving.
        Date completionDate = request != null && request.getCompletionDate() != null
                ? request.getCompletionDate()
                : new Date();
        String completionDateStr = DateUtil.convertDateToString(completionDate);
        namedPlaceholders.put("{{DATE_OF_COMPLETION}}", completionDateStr);
        namedPlaceholders.put("{{ISSUE_DATE}}", completionDateStr);
        // Identity + contact tokens. These were exposed in the visual editor's
        // chip palette but had no backend substitution, so admins who placed
        // them saw raw {{TOKEN}} text on the issued PDF. Empty string is the
        // safe fallback when the value is missing.
        namedPlaceholders.put("{{USER_ID}}", Optional.ofNullable(studentId).orElse(""));
        namedPlaceholders.put("{{EMAIL}}", Optional.ofNullable(learnerEmail).orElse(""));
        namedPlaceholders.put("{{MOBILE_NUMBER}}", Optional.ofNullable(learnerMobile).orElse(""));
        namedPlaceholders.put("{{ENROLLMENT_NUMBER}}", enrollmentNumber);
        // Institute logo as a URL is already handled by the legacy numeric
        // pass via key "5", but place it in the named map too so any template
        // referencing {{INSTITUTE_LOGO}} renders correctly even when the
        // legacy pass is short-circuited.
        namedPlaceholders.put("{{INSTITUTE_LOGO}}",
                Optional.ofNullable(instituteImageUrl).orElse(""));
        // Institute theme color, used for borders / accents in the certificate.
        // Falls back to the historical default border color so older templates
        // that hardcoded {{INSTITUTE_THEME_COLOR}} still render sanely.
        // Only prefix # for bare hex codes (3/6/8 hex chars); leave CSS color
        // names like "purple" alone — "#purple" is invalid CSS.
        String themeColor = studentSessionInstituteGroupMapping.getInstitute().getInstituteThemeCode();
        if (themeColor == null || themeColor.isBlank()) {
            themeColor = "#1e4fa1";
        } else {
            String trimmed = themeColor.trim();
            if (trimmed.matches("^(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")) {
                themeColor = "#" + trimmed;
            } else {
                themeColor = trimmed;
            }
        }
        namedPlaceholders.put("{{INSTITUTE_THEME_COLOR}}", themeColor);

        // Two-pass tolerant substitution. Pass 1 is a regex that allows
        // whitespace padding and case variations inside the braces (handles
        // `{{ ISSUE_DATE }}`, `{{issue_date}}`, non-breaking spaces, etc. that
        // creep in when admins paste templates from Google Docs / Word).
        // Pass 2 is a plain literal `String.replace` belt-and-suspenders catch
        // for the canonical `{{TOKEN}}` form — so even if the regex misses an
        // edge case (e.g., values containing `{{` that confuse subsequent
        // matches), the exact-match token still gets resolved. Without pass 2,
        // bugs in pass 1 would silently render tokens as raw text on the
        // issued PDF.
        for (Map.Entry<String, String> entry : namedPlaceholders.entrySet()) {
            if (entry.getValue() == null) continue;
            String token = entry.getKey();
            String inner = token.substring(2, token.length() - 2);
            String pattern = "\\{\\{\\s*" + java.util.regex.Pattern.quote(inner) + "\\s*\\}\\}";
            try {
                filledTemplate = java.util.regex.Pattern
                        .compile(pattern, java.util.regex.Pattern.CASE_INSENSITIVE)
                        .matcher(filledTemplate)
                        .replaceAll(java.util.regex.Matcher.quoteReplacement(entry.getValue()));
            } catch (Exception ignored) {
                // Regex blew up for some reason — fall through to the literal
                // pass below.
            }
            // Pass 2: literal exact-match replacement. Safe even if pass 1
            // already replaced everything (contains() returns false then).
            if (filledTemplate.contains(token)) {
                filledTemplate = filledTemplate.replace(token, entry.getValue());
            }
        }

        // Legacy numeric placeholder pass — runs AFTER the named pass so its
        // historically-swapped mapping (key "1" points at {{COURSE_NAME}} but
        // stores the session name) can no longer hijack tokens the named pass
        // already consumed. Existing templates that rely on the legacy pass
        // for tokens like {{DATE_OF_COMPLETION}} / {{TODAY_DATE}} / {{LEVEL}}
        // / {{INSTITUTE_LOGO}} / {{SIGNATURE}} / {{DESIGNATION}} still work
        // because the named pass doesn't touch those.
        for (Map.Entry<String, String> entry : defaultPlaceHolders.entrySet()) {
            String placeholder = entry.getValue();
            String value = placeHolderMapping.get(entry.getKey());
            if (value != null && filledTemplate.contains(placeholder)) {
                filledTemplate = filledTemplate.replace(placeholder, value);
            }
        }

        // Critical-token guard: a final unconditional pass over the must-show
        // tokens. The loops above usually catch everything, but if a saved
        // template has an unusual variant the loops miss, this guarantees the
        // learner never sees a raw {{TOKEN}} on the issued PDF. Each line is
        // a plain `String.replace` so there's no way for it to silently no-op.
        String safeCertId = certificateId == null ? "" : certificateId;
        String safeStudent = learnerName == null ? "" : learnerName;
        String safeCourse = courseName == null ? "" : courseName;
        String safeInstitute = studentSessionInstituteGroupMapping.getInstitute() != null
                && studentSessionInstituteGroupMapping.getInstitute().getInstituteName() != null
                ? studentSessionInstituteGroupMapping.getInstitute().getInstituteName() : "";
        filledTemplate = filledTemplate.replace("{{CERTIFICATE_ID}}", safeCertId);
        filledTemplate = filledTemplate.replace("{{STUDENT_NAME}}", safeStudent);
        filledTemplate = filledTemplate.replace("{{COURSE_NAME}}", safeCourse);
        filledTemplate = filledTemplate.replace("{{PACKAGE_NAME}}", safeCourse);
        filledTemplate = filledTemplate.replace("{{INSTITUTE_NAME}}", safeInstitute);
        String safeDate = completionDateStr == null ? "" : completionDateStr;
        filledTemplate = filledTemplate.replace("{{DATE_OF_COMPLETION}}", safeDate);
        filledTemplate = filledTemplate.replace("{{ISSUE_DATE}}", safeDate);

        // Always show the certificate id at the bottom-right of the rendered
        // page, regardless of whether the admin placed {{CERTIFICATE_ID}} in
        // the template.
        filledTemplate = appendCertificateIdBadge(filledTemplate, certificateId);

        // Render the PDF using the institute-configured page size if present.
        final String renderedHtml = filledTemplate;
        float[] pageSizeMm = getPageSizeMm(settingJson, CertificateTypeEnum.COURSE_COMPLETION.name());
        Optional<FileDetailsDTO> uploaded = uploadToAws(convertHtmlToPdf(renderedHtml, "course_certification", pageSizeMm),
                studentSessionInstituteGroupMapping.getUserId() + "course_certification");

        // Persist the audit row with the rendered HTML snapshot. Failures here
        // are logged but do not block delivery — the learner still gets the PDF.
        final Integer auditPercentage = request != null ? request.getCompletionPercentage() : null;
        uploaded.ifPresent(file -> {
            try {
                IssuedCertificate audit = IssuedCertificate.builder()
                        .id(certificateId)
                        // Mirror into the self-documenting column. Same value
                        // as `id` — the substitution loop above uses this same
                        // `certificateId` for {{CERTIFICATE_ID}} in both Visual
                        // and HTML editor templates, so reading certificate_id
                        // here is guaranteed to match what was rendered on the
                        // PDF the learner downloads.
                        .certificateId(certificateId)
                        .instituteId(studentSessionInstituteGroupMapping.getInstitute().getId())
                        .userId(studentSessionInstituteGroupMapping.getUserId())
                        .packageSessionId(studentSessionInstituteGroupMapping.getPackageSession() != null
                                ? studentSessionInstituteGroupMapping.getPackageSession().getId() : null)
                        .courseName(courseName)
                        .completionPercentage(auditPercentage)
                        .issuedAt(new Date())
                        .fileId(file.getId())
                        .templateHtmlSnapshot(renderedHtml)
                        .build();
                issuedCertificateRepository.save(audit);
            } catch (Exception e) {
                log.error("Failed to persist IssuedCertificate audit row: {}", e.getMessage());
            }
        });

        return uploaded;
    }

    public MultipartFile convertHtmlToPdf(String htmlContent, String fileName) {
        return convertHtmlToPdf(htmlContent, fileName, null);
    }

    public MultipartFile convertHtmlToPdf(String htmlContent, String fileName, float[] pageSizeMm) {
        try {
            String htmlWithCss;

            // Check if htmlContent is already a complete HTML document
            boolean isCompleteHtml = htmlContent.trim().toLowerCase().startsWith("<!doctype") ||
                    htmlContent.trim().toLowerCase().startsWith("<html");

            if (isCompleteHtml) {
                // Use the HTML content as-is since it's already complete
                htmlWithCss = htmlContent;
            } else {
                // Wrap partial HTML content with our default styling
                htmlWithCss = "<!DOCTYPE html>" +
                        "<html xmlns=\"http://www.w3.org/1999/xhtml\">" +
                        "<head>" +
                        "  <meta charset=\"UTF-8\" />" +
                        "  <style>" +
                        "    @page { " +
                        "      margin: 15mm; " +
                        "      size: auto; " +
                        "    } " +
                        "    body { " +
                        "      font-family: Arial, sans-serif; " +
                        "      line-height: 1.4; " +
                        "      max-width: 210mm; " + // A4 width minus margins
                        "      min-width: 100mm; " + // Minimum reasonable width
                        "      width: fit-content; " +
                        "      margin: 0 auto; " +
                        "      box-sizing: border-box; " +
                        "    } " +
                        "    * { " +
                        "      max-width: 100%; " +
                        "      box-sizing: border-box; " +
                        "    } " +
                        "    img { " +
                        "      max-width: 100%; " +
                        "      height: auto; " +
                        "    } " +
                        "    table { " +
                        "      width: 100%; " +
                        "      table-layout: auto; " +
                        "    } " +
                        "  </style>" +
                        "</head>" +
                        "<body>" +
                        htmlContent +
                        "</body></html>";
            }
            // Prepare output stream
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

            // Build the PDF
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();

            // Enable image support and set proper rendering options
            builder.useFont(() -> {
                try {
                    return this.getClass().getResourceAsStream("/fonts/Arial.ttf");
                } catch (Exception e) {
                    return null; // Fallback to system fonts
                }
            }, "Arial");

            // Process HTML to ensure images are properly handled
            String processedHtml = processImagesForPdf(htmlWithCss);

            // Set base URI for relative image paths (if needed)
            String baseUri = "file:///";
            builder.withHtmlContent(sanitizeToXhtml(processedHtml), baseUri);

            // Apply institute-configured page size if provided; otherwise fall
            // back to the historical A4 landscape default.
            if (pageSizeMm != null && pageSizeMm.length == 2) {
                builder.useDefaultPageSize(pageSizeMm[0], pageSizeMm[1], PdfRendererBuilder.PageSizeUnits.MM);
            } else {
                builder.useDefaultPageSize(297f, 210f, PdfRendererBuilder.PageSizeUnits.MM); // A4 landscape as fallback
            }

            // Remove fixed page size to allow dynamic sizing based on content

            builder.toStream(outputStream);
            builder.run();

            // Create MultipartFile from the PDF bytes
            return new InMemoryMultipartFile(
                    fileName,
                    fileName + ".pdf",
                    "application/pdf",
                    outputStream.toByteArray());
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }

    public static String sanitizeToXhtml(String html) {
        Document doc = Jsoup.parse(html);
        doc.outputSettings().syntax(Document.OutputSettings.Syntax.xml);
        doc.outputSettings().escapeMode(Entities.EscapeMode.xhtml);
        String xhtml = doc.html();
        // Jsoup emits <style>/<script> contents verbatim, so a bare '&' inside
        // e.g. a Google Fonts rule — @import url('...?family=A&family=B&display=swap')
        // — survives unescaped and breaks OpenHTML2PDF's strict XML parser
        // ("The reference to entity 'family' must end with the ';' delimiter").
        // Escape any ampersand that isn't already a valid XML/HTML entity so such
        // templates (and the bundled default fallback) render instead of throwing.
        xhtml = xhtml.replaceAll("&(?!(?:amp|lt|gt|quot|apos|#\\d+|#x[0-9a-fA-F]+);)", "&amp;");
        return xhtml;
    }

    private String processImagesForPdf(String html) {
        try {
            Document doc = Jsoup.parse(html);
            Elements images = doc.select("img");

            for (Element img : images) {
                String src = img.attr("src");
                if (src != null && !src.isEmpty()) {
                    // Handle different image source types
                    if (src.startsWith("http://") || src.startsWith("https://")) {
                        // For HTTP/HTTPS URLs, try to convert to base64
                        try {
                            String base64Image = convertUrlToBase64(src);
                            if (base64Image != null) {
                                img.attr("src", base64Image);
                            }
                        } catch (Exception e) {
                            // If conversion fails, keep original URL
                            System.err.println("Failed to convert image URL to base64: " + src);
                        }
                    }
                    // For data: URLs (base64), keep as-is
                    // For file: URLs, keep as-is (will be resolved with baseUri)

                    // Ensure images have proper styling for PDF rendering
                    String style = img.attr("style");
                    if (!style.contains("max-width")) {
                        style += (style.isEmpty() ? "" : "; ") + "max-width: 100%; height: auto;";
                        img.attr("style", style);
                    }
                }
            }

            return doc.html();
        } catch (Exception e) {
            System.err.println("Error processing images for PDF: " + e.getMessage());
            return html; // Return original HTML if processing fails
        }
    }

    private String convertUrlToBase64(String imageUrl) {
        try {
            java.net.URL url = new java.net.URL(imageUrl);
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000); // 5 seconds timeout
            connection.setReadTimeout(10000); // 10 seconds timeout
            connection.setRequestProperty("User-Agent", "Mozilla/5.0 (PDF Generator)");

            if (connection.getResponseCode() == 200) {
                try (java.io.InputStream inputStream = connection.getInputStream();
                        java.io.ByteArrayOutputStream outputStream = new java.io.ByteArrayOutputStream()) {

                    byte[] buffer = new byte[4096];
                    int bytesRead;
                    while ((bytesRead = inputStream.read(buffer)) != -1) {
                        outputStream.write(buffer, 0, bytesRead);
                    }

                    byte[] imageBytes = outputStream.toByteArray();
                    String contentType = connection.getContentType();
                    if (contentType == null) {
                        contentType = "image/png"; // Default fallback
                    }

                    String base64 = java.util.Base64.getEncoder().encodeToString(imageBytes);
                    return "data:" + contentType + ";base64," + base64;
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to convert URL to base64: " + imageUrl + " - " + e.getMessage());
        }
        return null;
    }

    private Optional<FileDetailsDTO> uploadToAws(MultipartFile file, String title) {
        try {
            return Optional.of(mediaService.uploadFileV2(file));
        } catch (Exception e) {
            e.printStackTrace();
            return Optional.empty();
        }
    }

    public Optional<String> getCurrentCertificateTemplate(String json, String key) {
        try {
            JsonNode root = objectMapper.readTree(json);

            JsonNode certificateSettings = root.path("setting").path("CERTIFICATE_SETTING").path("data").path("data");
            if (certificateSettings.isArray() && !certificateSettings.isEmpty()) {

                for (JsonNode certificateConfig : certificateSettings) {
                    String configKey = certificateConfig.path("key").asText(null);

                    if (key.equals(configKey)) {
                        // Saving the template implies activation: if the admin
                        // has persisted a non-empty currentHtmlCertificateTemplate,
                        // always render it. The legacy isDefaultCertificateSettingOn
                        // gate is intentionally ignored — its semantics drifted
                        // from "use default" to "feature enabled" and the
                        // completion-percentage threshold upstream already gates
                        // issuance.
                        String saved = certificateConfig.path("currentHtmlCertificateTemplate").asText(null);
                        if (StringUtils.hasText(saved)) {
                            return Optional.of(saved);
                        }
                        return Optional.ofNullable(ConstantsSettingDefaultValue.getDefaultHtmlForType(key));
                    }
                }
            }

        } catch (Exception e) {
            log.warn("Failed to parse certificate template from institute setting", e);
        }
        return Optional.ofNullable(ConstantsSettingDefaultValue.getDefaultHtmlForType(key));
    }

    private static final Map<String, String> DEFAULT_PLACEHOLDERS = Map.of(
            "6", "Official Signatory",
            "7", " ");

    public static Map<String, String> extractPlaceholders(String json) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            CertificateSettingDataDto dataDto = mapper.readValue(json, CertificateSettingDataDto.class);

            if (dataDto == null || dataDto.getData() == null || dataDto.getData().isEmpty()) {
                return DEFAULT_PLACEHOLDERS;
            }

            CertificateSettingDto firstSetting = dataDto.getData().get(0);

            if (firstSetting == null || firstSetting.getPlaceHoldersMapping() == null) {
                return DEFAULT_PLACEHOLDERS;
            }

            return firstSetting.getPlaceHoldersMapping();

        } catch (Exception e) {
            // In case JSON parsing fails
            return DEFAULT_PLACEHOLDERS;
        }
    }

    @Transactional
    public String updateInstituteCurrentTemplate(Institute institute, CertificationGenerationRequest request)
            throws JsonProcessingException {
        String settingJson = institute.getSetting();

        // Deserialize
        InstituteSettingDto instituteSettingDto = objectMapper.readValue(settingJson, InstituteSettingDto.class);
        SettingDto certificateSettingDto = instituteSettingDto.getSetting().get("CERTIFICATE_SETTING");

        // Convert object to CertificateSettingDataDto properly
        CertificateSettingDataDto dataDto = objectMapper.convertValue(certificateSettingDto.getData(),
                CertificateSettingDataDto.class);

        // Update current template
        for (CertificateSettingDto data : dataDto.getData()) {
            if (data.getKey().equals(request.getKey())) {
                data.setCurrentHtmlCertificateTemplate(request.getCurrentHtmlTemplate());
            }
        }

        // Set the updated data back
        certificateSettingDto.setData(dataDto);

        // Put it back into settings map
        instituteSettingDto.getSetting().put("CERTIFICATE_SETTING", certificateSettingDto);

        // Serialize back to JSON
        String updatedJson = objectMapper.writeValueAsString(instituteSettingDto);

        // Update entity
        institute.setSetting(updatedJson);

        // Persist changes
        instituteRepository.save(institute);

        // Issued certificates are immutable: do NOT clear learners' cached
        // certificate file ids when the template changes. Already-issued
        // learners keep their certificate; only learners not yet issued render
        // against this newly-saved template on their next view. (Same rationale
        // as updateCertificateSetting.)

        return "Certificate Template Updated Successfully!";
    }

    public Object getSettingByInstituteIdAndKey(String instituteId, String settingKey) {
        Institute institute = instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute Not Found"));
        return getSettingData(institute, settingKey);
    }

    public void syncUserIdentifier(String instituteId, String userIdentifier) {
        authService.updateInstituteSettings(instituteId, userIdentifier);
    }
}

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
import vacademy.io.admin_core_service.features.institute.dto.settings.naming.NameSettingRequest;
import vacademy.io.admin_core_service.features.institute.enums.CertificateTypeEnum;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.common.core.utils.DateUtil;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
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

    public InstituteSettingService(InstituteRepository instituteRepository, ObjectMapper objectMapper,
            FileService fileService, MediaService mediaService, AuthService authService,
            InstituteCustomFiledService instituteCustomFiledService, SettingStrategyFactory settingStrategyFactory) {
        this.instituteRepository = instituteRepository;
        this.objectMapper = objectMapper;
        this.mediaService = mediaService;
        this.authService = authService;
        this.instituteCustomFiledService = instituteCustomFiledService;
        this.settingStrategyFactory = settingStrategyFactory;
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

    public void updateCertificateSetting(Institute institute, CertificateSettingRequest request) {
        String settingJsonString = settingStrategyFactory.rebuildOldSettingAndGetSettingJsonString(institute, request,
                SettingKeyEnums.CERTIFICATE_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
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
                if (isCompulsory(field.getFieldName())) {
                    compulsoryCustomFields.add(field.getCustomFieldId());
                }
                if (field.getFieldName().equals("username")) {
                    field.setLocations(ConstantsSettingDefaultValue.getUsernamePasswordLocations().stream().toList());
                }
                if (field.getFieldName().equals("password")) {
                    field.setLocations(ConstantsSettingDefaultValue.getUsernamePasswordLocations().stream().toList());
                }
                if (field.getFieldName().equals("batch")) {
                    field.setLocations(ConstantsSettingDefaultValue.getBatchLocations().stream().toList());
                }
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
        return !field.equals("username") && !field.equals("password") && !field.equals("batch");
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
        Map<String, String> placeHoldersValueMapping = extractPlaceholders(setting);

        Optional<String> currentHtmlCertificateTemplate = getCurrentCertificateTemplate(setting,
                CertificateTypeEnum.COURSE_COMPLETION.name());
        return currentHtmlCertificateTemplate.flatMap(s -> createCertificateUrlFromTemplateAndLearnerData(s,
                instituteStudentMapping.get(), placeHoldersValueMapping, request));

    }

    private Optional<FileDetailsDTO> createCertificateUrlFromTemplateAndLearnerData(
            String template,
            StudentSessionInstituteGroupMapping studentSessionInstituteGroupMapping,
            Map<String, String> placeHoldersValueMapping, CertificationGenerationRequest request) {

        // Your mapping (placeholder key -> actual value)
        Map<String, String> placeHolderMapping = new HashMap<>();
        String studentId = studentSessionInstituteGroupMapping.getUserId();
        String learnerName = authService.getUsersFromAuthServiceByUserIds(List.of(studentId)).get(0).getFullName();

        String instituteImageUrl = mediaService
                .getFileUrlById(studentSessionInstituteGroupMapping.getInstitute().getLogoFileId());

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

        // Replace only placeholders that exist in the template
        for (Map.Entry<String, String> entry : defaultPlaceHolders.entrySet()) {
            String placeholder = entry.getValue(); // e.g. {{COURSE_NAME}}
            String value = placeHolderMapping.get(entry.getKey()); // mapped value

            if (value != null && filledTemplate.contains(placeholder)) {
                filledTemplate = filledTemplate.replace(placeholder, value);
            }
        }

        return uploadToAws(convertHtmlToPdf(filledTemplate, "course_certification"),
                studentSessionInstituteGroupMapping.getUserId() + "course_certification");
    }

    public MultipartFile convertHtmlToPdf(String htmlContent, String fileName) {
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

            // Enable image rendering with better quality
            builder.useDefaultPageSize(297f, 210f, PdfRendererBuilder.PageSizeUnits.MM); // A4 landscape as fallback

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
        return doc.html();
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
                        boolean isDefaultOn = certificateConfig.path("isDefaultCertificateSettingOn").asBoolean(false);

                        if (isDefaultOn) {
                            String template = certificateConfig.path("currentHtmlCertificateTemplate").asText(null);
                            return Optional.ofNullable(template);
                        } else {
                            return Optional.empty();
                        }
                    }
                }
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
        return Optional.empty();
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

        return "Certificate Template Updated Successfully!";
    }

}

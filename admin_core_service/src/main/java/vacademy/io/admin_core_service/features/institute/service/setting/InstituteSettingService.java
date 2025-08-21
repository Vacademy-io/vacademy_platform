package vacademy.io.admin_core_service.features.institute.service.setting;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itextpdf.styledxmlparser.jsoup.Jsoup;
import com.itextpdf.styledxmlparser.jsoup.nodes.Document;
import com.itextpdf.styledxmlparser.jsoup.nodes.Entities;
import com.openhtmltopdf.outputdevice.helper.BaseRendererBuilder;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute.constants.ConstantsSettingDefaultValue;
import vacademy.io.admin_core_service.features.institute.dto.settings.InstituteSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.SettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.certificate.CertificateSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.certificate.CertificateSettingRequest;
import vacademy.io.admin_core_service.features.institute.dto.settings.naming.NameSettingRequest;
import vacademy.io.admin_core_service.features.institute.enums.CertificateTypeEnum;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.common.media.dto.InMemoryMultipartFile;
import vacademy.io.common.media.service.FileService;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.*;


@Service
public class InstituteSettingService {

    private final SettingStrategyFactory settingStrategyFactory;
    private final InstituteRepository instituteRepository;
    private final StudentSessionInstituteGroupMappingRepository instituteGroupMappingRepository;
    private final ObjectMapper objectMapper;
    private final MediaService mediaService;
    private final AuthService authService;

    public InstituteSettingService(InstituteRepository instituteRepository, StudentSessionInstituteGroupMappingRepository instituteGroupMappingRepository, ObjectMapper objectMapper, FileService fileService, MediaService mediaService, AuthService authService) {
        this.instituteRepository = instituteRepository;
        this.instituteGroupMappingRepository = instituteGroupMappingRepository;
        this.objectMapper = objectMapper;
        this.mediaService = mediaService;
        this.authService = authService;
        this.settingStrategyFactory = new SettingStrategyFactory();
    }


    public void createNewNamingSetting(Institute institute, NameSettingRequest request){
        String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute,request, SettingKeyEnums.NAMING_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    public void createNewCertificateSetting(Institute institute, CertificateSettingStrategy request){
        String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute,request, SettingKeyEnums.CERTIFICATE_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    public void updateCertificateSetting(Institute institute, CertificateSettingRequest request){
        String settingJsonString = settingStrategyFactory.rebuildOldSettingAndGetSettingJsonString(institute,request, SettingKeyEnums.CERTIFICATE_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    public void createDefaultCertificateSetting(Institute institute){
        CertificateSettingRequest request = new CertificateSettingRequest();
        CertificateSettingDto settingDto = new CertificateSettingDto();

        settingDto.setKey(CertificateTypeEnum.COURSE_COMPLETION.name());
        settingDto.setIsDefaultCertificateSettingOn(false);
        settingDto.setDefaultHtmlCertificateTemplate(ConstantsSettingDefaultValue.getDefaultHtmlForType(CertificateTypeEnum.COURSE_COMPLETION.name()));
        settingDto.setCurrentHtmlCertificateTemplate(ConstantsSettingDefaultValue.getDefaultHtmlForType(CertificateTypeEnum.COURSE_COMPLETION.name()));

        Map<String, CertificateSettingDto> settingDtoMap = new HashMap<>();
        settingDtoMap.put(CertificateTypeEnum.COURSE_COMPLETION.name(), settingDto);
        request.setRequest(settingDtoMap);


        String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute,request, SettingKeyEnums.CERTIFICATE_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    public void updateNamingSetting(Institute institute, NameSettingRequest request){
        String settingJsonString = settingStrategyFactory.rebuildOldSettingAndGetSettingJsonString(institute,request, SettingKeyEnums.NAMING_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    public void createDefaultNamingSetting(Institute institute, NameSettingRequest request){
        String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute,request, SettingKeyEnums.NAMING_SETTING.name());
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    // Generic methods for any setting type
    public void createNewGenericSetting(Institute institute, String settingKey, Object settingData){
        String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute, settingData, settingKey);
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    public void updateGenericSetting(Institute institute, String settingKey, Object settingData){
        String settingJsonString = settingStrategyFactory.rebuildOldSettingAndGetSettingJsonString(institute, settingData, settingKey);
        institute.setSetting(settingJsonString);
        instituteRepository.save(institute);
    }

    // Upsert method - creates if doesn't exist, updates if exists
    public void saveGenericSetting(Institute institute, String settingKey, Object settingData){
        String settingJsonString = settingStrategyFactory.buildNewSettingAndGetSettingJsonString(institute, settingData, settingKey);
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

    public Optional<FileDetailsDTO> ifEligibleForCourseCertificationForUserAndPackageSession(String userId, String packageSessionId) {
        Optional<StudentSessionInstituteGroupMapping> instituteStudentMapping = instituteGroupMappingRepository.findByUserIdAndPackageSessionId(userId, packageSessionId);
        if(instituteStudentMapping.isEmpty()) return Optional.empty();
        if(instituteStudentMapping.get().getInstitute()==null) return Optional.empty();

        String setting = instituteStudentMapping.get().getInstitute().getSetting();
        if(!StringUtils.hasText(setting)) return Optional.empty();

        Optional<String> currentHtmlCertificateTemplate = getCurrentCertificateTemplate(setting,CertificateTypeEnum.COURSE_COMPLETION.name());
        return currentHtmlCertificateTemplate.flatMap(s -> createCertificateUrlFromTemplateAndLearnerData(s, instituteStudentMapping.get()));

    }

    private Optional<FileDetailsDTO> createCertificateUrlFromTemplateAndLearnerData(
            String template,
            StudentSessionInstituteGroupMapping studentSessionInstituteGroupMapping) {

        // Your mapping (placeholder key -> actual value)
        Map<String, String> placeHolderMapping = new HashMap<>();
        String studentId = studentSessionInstituteGroupMapping.getUserId();
        String learnerName = authService.getUsersFromAuthServiceByUserIds(List.of(studentId)).get(0).getFullName();

        placeHolderMapping.put("1", studentSessionInstituteGroupMapping.getPackageSession().getSession().getSessionName());
        placeHolderMapping.put("2", studentSessionInstituteGroupMapping.getPackageSession().getLevel().getLevelName());
        placeHolderMapping.put("3", learnerName);
        placeHolderMapping.put("4", new Date().toString());
        placeHolderMapping.put("5", "https://www.differencebetween.net/wp-content/uploads/2018/03/Difference-Between-Institute-and-University--768x520.jpg");
        placeHolderMapping.put("6", "Head Of Officials");
        placeHolderMapping.put("7", "PIYUSH RAJ");
        placeHolderMapping.put("8", studentSessionInstituteGroupMapping.getInstitute().getInstituteName());

        // Your default placeholders
        Map<String, String> defaultPlaceHolders = ConstantsSettingDefaultValue.getDefaultPlaceHolders();

        String filledTemplate = template;

        // Replace only placeholders that exist in the template
        for (Map.Entry<String, String> entry : defaultPlaceHolders.entrySet()) {
            String placeholder = entry.getValue();   // e.g. {{COURSE_NAME}}
            String value = placeHolderMapping.get(entry.getKey()); // mapped value

            if (value != null && filledTemplate.contains(placeholder)) {
                filledTemplate = filledTemplate.replace(placeholder, value);
            }
        }


        return uploadToAws(convertHtmlToPdf(filledTemplate, "course_certification"), studentSessionInstituteGroupMapping.getUserId() +"course_certification");
    }

    public MultipartFile convertHtmlToPdf(String htmlContent, String fileName){
        try{
            String htmlWithCss =
                    "<!DOCTYPE html>" +
                            "<html xmlns=\"http://www.w3.org/1999/xhtml\">" +
                            "<head>" +
                            "  <meta charset=\"UTF-8\" />" +
                            "  <style>@page { size: A4 landscape; margin: 20mm; }</style>" +
                            "</head>" +
                            "<body>" +
                            htmlContent +
                            "</body></html>";
            // Prepare output stream
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

            // Build the PDF
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(sanitizeToXhtml(htmlWithCss), null);

            // Force A4 Landscape (842 x 595 points)
            builder.useDefaultPageSize(20.5f, 10.3f, PdfRendererBuilder.PageSizeUnits.INCHES);

            builder.toStream(outputStream);
            builder.run();

            // Create MultipartFile from the PDF bytes
            return new InMemoryMultipartFile(
                    fileName,
                    fileName + ".pdf",
                    "application/pdf",
                    outputStream.toByteArray()
            );
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


    private Optional<FileDetailsDTO> uploadToAws(MultipartFile file, String title){
        try{
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
}

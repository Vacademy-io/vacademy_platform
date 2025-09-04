package vacademy.io.admin_core_service.features.institute.constants;

import lombok.Getter;
import vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.FixedFieldRenameDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.naming.NameSettingRequest;
import vacademy.io.admin_core_service.features.institute.enums.CertificateTypeEnum;

import java.util.*;

public class ConstantsSettingDefaultValue {

    private static final Map<String, String> nameDefaultValues = new HashMap<>();
    private static final Map<String, String> certificateTypeDefaultValues = new HashMap<>();
    private static final List<String> defaultCustomFieldsLocations = new ArrayList<>();
    private static final Map<String, String> fixedColumnsNameMapping = new HashMap<>();

    @Getter
    private static final Map<String, String> defaultPlaceHolders = new HashMap<>();

    static {
        nameDefaultValues.put("Course", "Course");
        nameDefaultValues.put("Level", "Level");
        nameDefaultValues.put("Session", "Session");
        nameDefaultValues.put("Subjects", "Subjects");
        nameDefaultValues.put("Modules", "Modules");
        nameDefaultValues.put("Chapters", "Chapters");
        nameDefaultValues.put("Slides", "Slides");
        nameDefaultValues.put("Admin", "Admin");
        nameDefaultValues.put("Teacher", "Teacher");
        nameDefaultValues.put("CourseCreator", "Course Creator");
        nameDefaultValues.put("AssessmentCreator", "Assessment Creator");
        nameDefaultValues.put("Evaluator", "Evaluator");
        nameDefaultValues.put("Student", "Student");
        nameDefaultValues.put("LiveSession", "Live Session");

        certificateTypeDefaultValues.put(CertificateTypeEnum.COURSE_COMPLETION.name(), getDefaultHtmlCourseCertificateTemplate());

        defaultPlaceHolders.put("1","{{COURSE_NAME}}");
        defaultPlaceHolders.put("2","{{LEVEL}}");
        defaultPlaceHolders.put("3","{{STUDENT_NAME}}");
        defaultPlaceHolders.put("4","{{DATE_OF_COMPLETION}}");
        defaultPlaceHolders.put("5","{{INSTITUTE_LOGO}}");
        defaultPlaceHolders.put("6","{{DESIGNATION}}");
        defaultPlaceHolders.put("7","{{SIGNATURE}}");
        defaultPlaceHolders.put("8", "{{INSTITUTE_NAME}}");
        defaultPlaceHolders.put("9", "{{TODAY_DATE}}");

        defaultCustomFieldsLocations.add("Learner’s List");
        defaultCustomFieldsLocations.add("Enroll Request List");
        defaultCustomFieldsLocations.add("Invite List");
        defaultCustomFieldsLocations.add("Assessment Registration Form");
        defaultCustomFieldsLocations.add("Live Session Registration Form");
        defaultCustomFieldsLocations.add("Learner Profile");

        fixedColumnsNameMapping.put("username","username");
        fixedColumnsNameMapping.put("email","email");
        fixedColumnsNameMapping.put("fullName","fullName");
        fixedColumnsNameMapping.put("addressLine","addressLine");
        fixedColumnsNameMapping.put("region","region");
        fixedColumnsNameMapping.put("city","city");
        fixedColumnsNameMapping.put("pinCode","pinCode");
        fixedColumnsNameMapping.put("mobileNumber","mobileNumber");
        fixedColumnsNameMapping.put("dateOfBerth","dateOfBerth");
        fixedColumnsNameMapping.put("gender","gender");
        fixedColumnsNameMapping.put("fatherName","fatherName");
        fixedColumnsNameMapping.put("motherName","motherName");
        fixedColumnsNameMapping.put("parentMobileName","parentMobileName");
        fixedColumnsNameMapping.put("parentEmail","parentEmail");
        fixedColumnsNameMapping.put("linkedInstituteName","linkedInstituteName");
        fixedColumnsNameMapping.put("parentToMotherMobileNumber","parentToMotherMobileNumber");
        fixedColumnsNameMapping.put("parentsToMotherEmail","parentsToMotherEmail");
    }

    public static List<FixedFieldRenameDto> getFixedColumnsRenameDto(){
        List<FixedFieldRenameDto> fixedFieldRenameDtos = new ArrayList<>();

        fixedColumnsNameMapping.forEach((key,value)->{
            fixedFieldRenameDtos.add(FixedFieldRenameDto.builder()
                    .key(toUpperSnakeCase(key))
                    .defaultValue(value)
                    .customValue(value).build());
        });

        return fixedFieldRenameDtos;
    }

    public static String toUpperSnakeCase(String input) {
        if (input == null || input.isEmpty()) {
            return input;
        }

        // Special case for "parent"
        if (input.equals("parent")) {
            return "PARENT";
        }

        // Convert camelCase / PascalCase to snake_case
        String result = input
                .replaceAll("([a-z])([A-Z])", "$1_$2") // insert _ between lowerUpper
                .replaceAll("([A-Z])([A-Z][a-z])", "$1_$2"); // insert _ between ABBc

        return result.toUpperCase();
    }

    public static NameSettingRequest getDefaultNamingSettingRequest() {
        NameSettingRequest request = new NameSettingRequest();

        Map<String, String> nameMap = new HashMap<>();
        List<String> keys = List.of(
                "Course", "Level", "Session",
                "Subjects", "Modules", "Chapters", "Slides",
                "Admin", "Teacher", "CourseCreator", "AssessmentCreator",
                "Evaluator", "Student", "LiveSession"
        );

        for (String key : keys) {
            nameMap.put(key, nameDefaultValues.get(key));
        }

        request.setNameRequest(nameMap);
        return request;
    }

    public static String getNameSystemValueForKey(String key) {
        return nameDefaultValues.get(key);
    }

    public static List<String> getDefaultCustomFieldLocations() {
        return defaultCustomFieldsLocations;
    }

    public static String getDefaultHtmlForType(String type){
        return certificateTypeDefaultValues.get(type);
    }

    private static String getDefaultHtmlCourseCertificateTemplate(){
        StringBuilder sb = new StringBuilder();
        sb.append("""
                <!DOCTYPE html>
                <html lang="en">
                
                <head>
                
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Montserrat:wght@400;600&family=Great+Vibes&display=swap');
                
                        body {
                            font-family: 'Montserrat', sans-serif;
                            background-color: #f0f4f8;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            margin: 0;
                            padding: 20px;
                            box-sizing: border-box;
                        }
                
                        .certificate-container {
                
                            width: 297mm;
                            height: 210mm;
                            background-color: #ffffff;
                            border: 12px solid #2d89e4;
                            box-shadow: 0 0 20px rgba(0, 0, 0, 0.15);
                            position: relative;
                            padding: 40px;
                            box-sizing: border-box;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            text-align: center;
                        }
                
                
                        .certificate-container::before {
                            content: '';
                            position: absolute;
                            top: 10px;
                            left: 10px;
                            right: 10px;
                            bottom: 10px;
                            border: 3px solid #a7c7e7;
                            z-index: 1;
                        }
                
                        .certificate-content {
                            position: relative;
                            z-index: 2;
                            width: 100%;
                            height: 100%;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: space-between;
                        }
                
                        .header {
                            width: 100%;
                        }
                
                        .institute-logo {
                            width: 120px;
                            height: auto;
                            object-fit: contain;
                        }
                
                        .title {
                            font-family: 'Playfair Display', serif;
                            font-size: 48px;
                            color: #1f3b64;
                            margin: 20px 0 10px 0;
                            font-weight: 700;
                        }
                
                        .subtitle {
                            font-size: 20px;
                            color: #555;
                            margin: 0 0 20px 0;
                        }
                
                        .student-name {
                            font-family: 'Great Vibes', cursive;
                            font-size: 64px;
                            color: #005a9c;
                            margin: 20px 0;
                            border-bottom: 2px solid #a7c7e7;
                            padding-bottom: 10px;
                            display: inline-block;
                        }
                
                        .completion-text {
                            font-size: 20px;
                            color: #333;
                            margin: 20px 0;
                            line-height: 1.6;
                        }
                
                        .course-name {
                            font-family: 'Montserrat', sans-serif;
                            font-size: 32px;
                            font-weight: 600;
                            color: #1f3b64;
                        }
                
                        .course-level {
                            font-size: 18px;
                            color: #555;
                            margin-top: 5px;
                        }
                
                        .footer {
                            width: 100%;
                            display: flex;
                            justify-content: space-around;
                            align-items: flex-end;
                            margin-top: auto;
                            padding-bottom: 20px;
                        }
                
                        .signature-block {
                            width: 40%;
                            text-align: center;
                        }
                
                        .signature-image {
                            width: 180px;
                            height: 60px;
                            object-fit: contain;
                        }
                
                        .signature-line {
                            border-top: 2px solid #333;
                            margin-top: 5px;
                            padding-top: 5px;
                        }
                
                        .signature-title {
                            font-size: 16px;
                            font-weight: 600;
                            color: #333;
                        }
                
                        .date-placeholder {
                            font-size: 18px;
                            font-weight: 600;
                            color: #333;
                            padding-bottom: 5px;
                        }
                
                
                        .seal {
                            position: absolute;
                            bottom: 60px;
                            right: 60px;
                            width: 120px;
                            height: 120px;
                            opacity: 0.8;
                            z-index: 3;
                        }
                
                        .footer-link {
                            font-weight: 600;
                            font-size: 15px;
                            color: #056cb6;
                        }
                
                
                        @page {
                            size: A4 landscape;
                            margin: 0;
                        }
                
                        @media print {
                            body {
                                background-color: #fff;
                                padding: 0;
                                margin: 0;
                            }
                
                            .certificate-container {
                                box-shadow: none;
                                margin: 0;
                                border: 10px solid #2d89e4;
                            }
                
                            .certificate-container::before {
                                border-width: 3px;
                            }
                
                        }
                    </style>
                </head>
                
                <body>
                    <div class="certificate-container">
                
                        <div class="certificate-content">
                            <div class="header">
                                <img src="{{INSTITUTE_LOGO}}" alt="Institute Logo" class="institute-logo" id="institute-logo">
                            </div>
                
                            <div class="main-content">
                                <h1 class="title">CERTIFICATE OF ACHIEVEMENT</h1>
                                <p class="subtitle">This certificate is proudly presented to</p>
                
                                <h2 class="student-name" id="student-name">{{STUDENT_NAME}}</h2>
                
                                <p class="completion-text">for the successful completion of the</p>
                
                                <div class="course-details">
                                    <h3 class="course-name" id="course-name">{{COURSE_NAME}}</h3>
                                    <p class="course-level" id="course-level">{{LEVEL}}</p>
                                </div>
                            </div>
                
                            <div class="footer">
                                <div class="signature-block">
                                    <p class="date-placeholder" id="completion-date">{{DATE_OF_COMPLETION}}</p>
                                    <div class="signature-line"></div>
                                    <p class="signature-title">Date of Completion</p>
                                </div>
                                <div class="signature-block">
                                    <img src="{{SIGNATURE}}" alt="Signature" class="signature-image" id="signature">
                                    <div class="signature-line"></div>
                                    <p class="signature-title" id="designation">{{DESIGNATION}}</p>
                                </div>
                            </div>
                
                            <div class="footer-link">
                                <p>WWW.CODECIRCLE.ORG</p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
                """);

        return sb.toString();
    }

    public static Collection<String> getUsernamePasswordLocations() {
        return List.of("Learner Profile","Learner’s List");
    }

    public static Collection<String> getBatchLocations(){
        return List.of("Enroll Request List");
    }
}

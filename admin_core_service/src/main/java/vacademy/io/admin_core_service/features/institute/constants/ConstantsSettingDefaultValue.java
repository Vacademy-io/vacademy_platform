package vacademy.io.admin_core_service.features.institute.constants;

import lombok.Getter;
import vacademy.io.admin_core_service.features.institute.dto.settings.naming.NameSettingRequest;
import vacademy.io.admin_core_service.features.institute.enums.CertificateTypeEnum;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ConstantsSettingDefaultValue {

    private static final Map<String, String> nameDefaultValues = new HashMap<>();
    private static final Map<String, String> certificateTypeDefaultValues = new HashMap<>();

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

    public static String getDefaultHtmlForType(String type){
        return certificateTypeDefaultValues.get(type);
    }

    private static String getDefaultHtmlCourseCertificateTemplate(){
        StringBuilder sb = new StringBuilder();
        sb.append("""
                <!DOCTYPE html>
                <html lang="en">
                
                <head>
                    <meta charset="UTF-8">
                    <title>Certificate</title>
                    <style>
                        @page {
                            size: A4 landscape;
                            margin: 0;
                        }
                
                        body {
                            margin: 0;
                            font-family: "Times New Roman", serif;
                            background: #f8f9fa;
                        }
                
                        .certificate {
                            width: 297mm;
                            /* A4 width */
                            height: 210mm;
                            /* A4 height */
                            margin: 0 auto;
                            background: #fff;
                            border: 10px solid #1e4fa1;
                            /* blue border */
                            box-sizing: border-box;
                            padding: 25mm;
                            text-align: center;
                            position: relative;
                        }
                
                        .corner {
                            position: absolute;
                            width: 260px;
                            height: 260px;
                            background: linear-gradient(135deg, #1e4fa1 50%, transparent 50%);
                            opacity: 0.1;
                        }
                
                        .corner.tl {
                            top: 0;
                            left: 0;
                        }
                
                        .corner.tr {
                            top: 0;
                            right: 0;
                            transform: scaleX(-1);
                        }
                
                
                        .logo {
                            width: 90px;
                            height: 90px;
                            margin-bottom: 8 px;
                            object-fit: contain;
                        }
                
                        .institute-name {
                            font-size: 24pt;
                            font-weight: bold;
                            margin: 10px;
                            color: #000;
                            margin-bottom: 6 px;
                        }
                
                        .title {
                            font-size: 20pt;
                            font-weight: bold;
                            color: #1e4fa1;
                            margin-bottom: 14px;
                            letter-spacing: 1px;
                        }
                
                        .subtitle {
                            font-size: 17pt;
                            margin: 0 0 20px;
                            color: #333;
                        }
                
                        .student-name {
                            font-size: 32pt;
                            font-weight: bold;
                            margin-top: 2px;
                            margin-bottom: 10px;
                            text-decoration: underline;
                            letter-spacing: 1px;
                            text-decoration-color: rgb(69, 67, 67);
                            /* underline color set to gray */
                        }
                
                        .course-text {
                            font-size: 17pt;
                            margin: 20px 12px;
                            color: #333;
                            line-height: 1.7;
                        }
                
                        /* Footer row */
                        .footer-row {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-end;
                            margin-top: 85px;
                        }
                
                        .date-block {
                            font-size: 15pt;
                            text-align: left;
                        }
                
                        .sign-block {
                            text-align: center;
                        }
                
                        .signature {
                            height: 60px;
                            /* adjust as needed */
                            object-fit: contain;
                            margin-bottom: 5px;
                        }
                
                        .sign-line {
                            border-top: 1px solid #000;
                            width: 200px;
                            margin: 5px auto 5px;
                        }
                
                        .sign-role {
                            font-size: 13pt;
                            font-weight: bold;
                        }
                    </style>
                </head>
                
                <body>
                    <div class="certificate">
                
                        <!-- Decorative corners -->
                        <div class="corner tl"></div>
                        <div class="corner tr"></div>
                
                        <!-- Logo -->
                        <img src="{{INSTITUTE_LOGO}}" alt="Institute Logo" class="logo" onerror="this.style.display='none'">
                
                        <!-- Institute Name -->
                        <h1 class="institute-name">{{INSTITUTE_NAME}}</h1>
                
                        <!-- Title -->
                        <h2 class="title">CERTIFICATE OF ACHIEVEMENT</h2>
                
                        <!-- Subtitle -->
                        <p class="subtitle">This certificate is proudly presented to</p>
                
                        <!-- Student Name -->
                        <div class="student-name">{{STUDENT_NAME}}</div>
                
                        <!-- Course Info -->
                        <p class="course-text">
                            for the successful completion of the <br>
                            <strong>{{COURSE_NAME}}</strong> ({{LEVEL}}) <br>
                            on {{DATE_OF_COMPLETION}}.
                        </p>
                
                        <!-- Footer -->
                        <div class="footer-row">
                            <!-- Left: Date -->
                            <div class="date-block">
                                Date: {{TODAY_DATE}}
                            </div>
                
                            <!-- Right: Signature + Designation -->
                            <div class="sign-block">
                                <img src="{{SIGNATURE}}" alt=" " class="signature" onerror="this.style.display='none'">
                                <div class="sign-line"></div>
                                <div class="sign-role">{{DESIGNATION}}</div>
                            </div>
                        </div>
                    </div>
                </body>
                
                </html>
                """);

        return sb.toString();
    }

}

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
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Certificate</title>
                    <style>
                
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            background-color: #f0f2f5;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            margin: 0;
                            padding: 20px;
                            box-sizing: border-box;
                        }
                
                
                        .certificate-container {
                            width: 100%;
                            max-width: 1000px;
                            background: #ffffff;
                            border: 10px solid #0d47a1;
                            padding: 25px;
                            box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
                            position: relative;
                            aspect-ratio: 11 / 8.5;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                        }
                
                
                        .certificate-container::before,
                        .certificate-container::after {
                            content: '';
                            position: absolute;
                            width: 150px;
                            height: 150px;
                            background-color: #e3f2fd; 
                            z-index: 1;
                        }
                
                        .certificate-container::before {
                            top: -5px;
                            left: -5px;
                            clip-path: polygon(0 0, 100% 0, 0 100%);
                        }
                
                        .certificate-container::after {
                            bottom: -5px;
                            right: -5px;
                            clip-path: polygon(100% 100%, 0 100%, 100% 0);
                        }
                
                
                        .certificate-content {
                            position: relative;
                            z-index: 2;
                            text-align: center;
                            padding: 20px;
                            display: flex;
                            flex-direction: column;
                            height: 100%;
                        }
                
                
                        .header {
                            margin-bottom: 20px;
                        }
                
                        .institute-logo {
                            max-width: 100px;
                            height: auto;
                            margin-bottom: 15px;
                        }
                
                        .institute-name {
                            font-size: 2.5em;
                            color: #0d2c4b;
                            font-weight: 700;
                            margin: 0;
                        }
                
                
                        .main-body {
                            flex-grow: 1; 
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                        }
                       \s
                        .main-body h2 {
                            font-size: 2em;
                            color: #1565c0;
                            font-weight: 600;
                            margin: 20px 0;
                            text-transform: uppercase;
                        }
                
                        .main-body p {
                            font-size: 1.2em;
                            color: #555;
                            margin: 10px 0;
                        }
                
                        .student-name {
                            font-family: 'Garamond', 'Times New Roman', serif;
                            font-size: 3em;
                            color: #000;
                            font-weight: bold;
                            border-bottom: 2px solid #ccc;
                            display: inline-block;
                            padding-bottom: 5px;
                            margin: 15px 0;
                        }
                
                        .course-details {
                            font-size: 1.4em;
                            color: #333;
                            font-weight: bold;
                        }
                
                        
                        .footer {
                            display: flex;
                            justify-content: space-between; 
                            align-items: flex-end;
                            margin-top: 50px;
                            width: 100%;
                        }
                
                        .signature-block {
                            text-align: center;
                            width: 45%; 
                        }
                       \s
                        .signature-name {
                            font-family: 'Garamond', 'Times New Roman', serif;
                            font-size: 1.2em;
                            font-weight: bold;
                            margin-bottom: 5px;
                        }
                
                        .designation {
                            font-size: 1em;
                            color: #444;
                            font-weight: bold;
                        }
                       \s
                        .date-block {
                            text-align: center;
                            width: 45%; 
                        }
                
                        .date-label {
                            font-size: 1em;
                            color: #444;
                            font-weight: bold;
                        }
                
                    </style>
                </head>
                <body>
                
                    <div class="certificate-container">
                        <div class="certificate-content">
                            <div class="header">
                                <img src="{{INSTITUTE_LOGO}}" alt="Institute Logo" class="institute-logo" id="instituteLogo">
                                <h1 class="institute-name" id="instituteName">{{INSTITUTE_NAME}}</h1>
                            </div>
                
                            <div class="main-body">
                                <h2>Certificate of Achievement</h2>
                                <p>This certificate is proudly presented to</p>
                                <h3 class="student-name" id="studentName">{{LEARNER_NAME}}</h3>
                                <p>for the successful completion of the</p>
                                <p class="course-details">
                                    <span id="courseName">{{COURSE_NAME}}</span>
                                    (<span id="level">{{LEVEL}}</span>)
                                </p>
                                <p>in the year <span id="year">{{YEAR}}</span>.</p>
                            </div>
                
                            <div class="footer">
                                <div class="date-block">
                                    <p class="date-label">Date: <span id="completionDate">{{DATE_OF_COMPLETION}}</span></p>
                                </div>
                                <div class="signature-block">
                                    <p class="signature-name">{{SIGNATURE}}</p>
                                    <p class="designation" id="designation">{{DESIGNATION}}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                
                </body>
                </html>
                """);

        return sb.toString();
    }

}

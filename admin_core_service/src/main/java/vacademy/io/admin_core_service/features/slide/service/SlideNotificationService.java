package vacademy.io.admin_core_service.features.slide.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification.service.NotificationService;
import vacademy.io.admin_core_service.features.slide.entity.Slide;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class SlideNotificationService {

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private InstituteStudentRepository instituteStudentRepository;

    @Autowired
    private NotificationService notificationService;

    public void sendNotificationForAddingSlide(Chapter chapter, Slide slide) {
        Institute institute = getInstituteByChapter(chapter);
        List<Student> students = getStudentsByChapter(chapter);

        List<NotificationToUserDTO> notificationUsers = prepareNotificationUsers(students, chapter, institute);
        NotificationDTO notificationDTO = prepareNotificationDTO(slide, notificationUsers);

        notificationService.sendEmailToUsers(notificationDTO);
    }

    private Institute getInstituteByChapter(Chapter chapter) {
        return instituteRepository.findInstituteByChapterId(chapter.getId())
                .orElseThrow(() -> new VacademyException("Institute not found"));
    }

    private List<Student> getStudentsByChapter(Chapter chapter) {
        List<Student> students = instituteStudentRepository.findStudentsByChapterId(chapter.getId());
        if (students.isEmpty()) {
            throw new VacademyException("No students found for the given chapter.");
        }
        return students;
    }

    private List<NotificationToUserDTO> prepareNotificationUsers(List<Student> students, Chapter chapter, Institute institute) {
        List<NotificationToUserDTO> notificationUsers = new ArrayList<>();

        for (Student student : students) {
            Map<String, String> placeholders = new HashMap<>();
            placeholders.put("STUDENT_NAME", student.getFullName());
            placeholders.put("CHAPTER_NAME", chapter.getChapterName());
            placeholders.put("INSTITUTE_NAME", institute.getInstituteName());
            placeholders.put("MATERIAL_LINK", "https://your-platform.com/material/" + chapter.getId());

            NotificationToUserDTO notificationUser = new NotificationToUserDTO();
            notificationUser.setUserId(student.getUserId());
            notificationUser.setChannelId(student.getEmail());
            notificationUser.setPlaceholders(placeholders);
            notificationUsers.add(notificationUser);
        }

        return notificationUsers;
    }

    private NotificationDTO prepareNotificationDTO(Slide slide, List<NotificationToUserDTO> notificationUsers) {
        NotificationDTO notificationDTO = new NotificationDTO();
        notificationDTO.setBody(getEmailTemplate());
        notificationDTO.setNotificationType("EMAIL");
        notificationDTO.setSubject("New Study Material Available");
        notificationDTO.setSource("SLIDE");
        notificationDTO.setSourceId(slide.getId());
        notificationDTO.setUsers(notificationUsers);
        return notificationDTO;
    }

    private String getEmailTemplate() {
        return """
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            background-color: #f8f8f8;
                            margin: 0;
                            padding: 0;
                        }
                        .container {
                            max-width: 600px;
                            background: #ffffff;
                            margin: 20px auto;
                            padding: 20px;
                            border-radius: 8px;
                            box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
                            text-align: center;
                        }
                        .header {
                            background: #ED7424;
                            color: #ffffff;
                            padding: 15px;
                            font-size: 22px;
                            font-weight: bold;
                            border-radius: 8px 8px 0 0;
                        }
                        .content {
                            margin: 20px 0;
                            font-size: 16px;
                            color: #333;
                            line-height: 1.6;
                        }
                        .button {
                            display: inline-block;
                            padding: 12px 20px;
                            background: #ED7424;
                            color: #ffffff;
                            text-decoration: none;
                            font-size: 16px;
                            border-radius: 5px;
                            font-weight: bold;
                            margin-top: 10px;
                        }
                        .footer {
                            margin-top: 20px;
                            font-size: 14px;
                            color: #777;
                        }
                        .highlight {
                            color: #ED7424;
                            font-weight: bold;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">📚 New Study Material Added!</div>
                        <div class="content">
                            <p>Dear <span class="highlight">{{STUDENT_NAME}}</span>,</p>
                            <p>We are excited to inform you that new <strong>slides/study material</strong> have been added to:</p>
                            <p class="highlight">"<strong>{{CHAPTER_NAME}}</strong>"</p>
                            <p>Enhance your knowledge and stay ahead in your learning journey.</p>
                            <a href="{{MATERIAL_LINK}}" class="button">View Material</a>
                        </div>
                        <div class="footer">
                            <p>Happy Learning! 🚀</p>
                            <p><strong>{{INSTITUTE_NAME}}</strong></p>
                        </div>
                    </div>
                </body>
                </html>
                """;
    }
}

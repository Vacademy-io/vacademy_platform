package vacademy.io.admin_core_service.features.slide.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification_service.enums.CommunicationType;
import vacademy.io.admin_core_service.features.notification_service.enums.NotificationSourceEnum;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.admin_core_service.features.slide.entity.Slide;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class SlideNotificationService {

    private static final String SLIDE_ACCESS_URL = "http://localhost:3000";
    @Autowired
    private InstituteRepository instituteRepository;
    @Autowired
    private InstituteStudentRepository instituteStudentRepository;
    @Autowired
    private NotificationService notificationService;

    public void sendNotificationForAddingSlide(String instituteId, Chapter chapter, Slide slide) {
        Institute institute = instituteRepository.findById(instituteId).orElseThrow(() -> new VacademyException("Institute not found"));
        List<Student> students = getStudentsByChapter(chapter);

        List<NotificationToUserDTO> notificationUsers = prepareNotificationUsers(students, chapter, institute);
        NotificationDTO notificationDTO = prepareNotificationDTO(slide, notificationUsers);

        notificationService.sendEmailToUsers(notificationDTO);
    }


    private List<Student> getStudentsByChapter(Chapter chapter) {
        List<Student> students = instituteStudentRepository.findStudentsByChapterId(chapter.getId());
        return students;
    }

    private List<NotificationToUserDTO> prepareNotificationUsers(List<Student> students, Chapter chapter, Institute institute) {
        List<NotificationToUserDTO> notificationUsers = new ArrayList<>();

        for (Student student : students) {
            Map<String, String> placeholders = new HashMap<>();
            placeholders.put("STUDENT_NAME", student.getFullName());
            placeholders.put("CHAPTER_NAME", chapter.getChapterName());
            placeholders.put("INSTITUTE_NAME", institute.getInstituteName());
            placeholders.put("MATERIAL_LINK", SLIDE_ACCESS_URL);

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
        notificationDTO.setBody(SlideNotificationEmailBody.NEW_SLIDE_EMAIL_TEMPLATE);
        notificationDTO.setNotificationType(CommunicationType.EMAIL.name());
        notificationDTO.setSubject("New Study Material Available");
        notificationDTO.setSource(NotificationSourceEnum.SLIDE.name());
        notificationDTO.setSourceId(slide.getId());
        notificationDTO.setUsers(notificationUsers);
        return notificationDTO;
    }


}

package vacademy.io.admin_core_service.features.notification_service.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.institute.service.InstituteService;
import vacademy.io.admin_core_service.features.learner.utility.TemplateReader;
import vacademy.io.admin_core_service.features.notification.dto.EmailRequest;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification_service.enums.CommunicationType;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.institute.entity.Institute;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class SendUniqueLinkService {
    @Autowired
    private InstituteService service;

    @Autowired
    private NotificationService notificationService;
    @Autowired
    private TemplateReader templateReader;

    public void sendUniqueLinkByEmail(String instituteId, UserDTO user){
        Institute institute=service.findById(instituteId);
        if(institute!=null){
            String emailBody = templateReader.getEmailBody(institute.getSetting());
            if(emailBody!=null){
                NotificationDTO notificationDTO=new NotificationDTO();
                notificationDTO.setNotificationType(CommunicationType.EMAIL.name());
                notificationDTO.setBody(emailBody);
                notificationDTO.setSubject("Welcome to "+institute.getInstituteName());
                NotificationToUserDTO notificationToUserDTO = new NotificationToUserDTO();
                notificationToUserDTO.setUserId(user.getId());
                notificationToUserDTO.setChannelId(user.getEmail());
                Map<String,String> map=new HashMap<>();
                map.put("name",user.getFullName());
                map.put("unique_link",institute.getWebsiteUrl()+"/live/join/"+user.getUsername());
                notificationToUserDTO.setPlaceholders(map);
                notificationDTO.setUsers(List.of(notificationToUserDTO));
                notificationService.sendEmailToUsers(notificationDTO,instituteId);
            }
        }
    }
    public void sendUniqueLinkByWhatsApp(String instituteId,UserDTO user){
        Institute institute=service.findById(instituteId);
        if(institute!=null) {
            templateReader.sendWhatsAppMessage(institute.getSetting(),user,institute.getWebsiteUrl() + "/live/join/" + user.getUsername(),instituteId);
        }

    }
}

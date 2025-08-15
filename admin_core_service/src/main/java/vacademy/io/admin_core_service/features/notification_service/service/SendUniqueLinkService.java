package vacademy.io.admin_core_service.features.notification_service.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.institute.service.InstituteService;
import vacademy.io.admin_core_service.features.learner.utility.TemplateReader;
import vacademy.io.admin_core_service.features.notification.dto.EmailRequest;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.institute.entity.Institute;
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
            String emailBody = templateReader.getEmailBody(institute.getSetting(), user.getFullName(), institute.getWebsiteUrl() + "/live/join/" + user.getUsername());
            if(emailBody!=null){
                EmailRequest emailRequest=new EmailRequest();
                emailRequest.setTo(user.getEmail());
                emailRequest.setText(emailBody);
                emailRequest.setSubject("Welcome to "+institute.getInstituteName());
                notificationService.sendTextEmail(emailRequest,instituteId);
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

package vacademy.io.admin_core_service.features.live_session.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.institute_learner.dto.UserNameEmailAndMobileNumber;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class LiveClassNotification {
    private boolean byMail;
    private boolean byWhatsapp;
    private List<UserNameEmailAndMobileNumber> userNameEmailAndMobileNumber;
}

package vacademy.io.admin_core_service.features.learner_invitation.notification;

public class LearnerInvitationEmailBody {
    private static final String LEARNER_INVITATION_FORM_URL = "https://frontend-learner-dashboard-app.pages.dev/login";
    private static final String LEARNER_STATUS_UPDATE_CHECK_URL = "https://frontend-learner-dashboard-app.pages.dev/login";
    public static String getLearnerInvitationEmailBody(String instituteName, String invitationCode) {
        return "<!DOCTYPE html>" +
                "<html>" +
                "<head>" +
                "<style>" +
                "body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: center; background-color: #f9f9f9; }" +
                ".container { max-width: 600px; margin: 40px auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background: white; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); }" +
                "h2 { color: #ffa31a; }" +
                "a { color: #ffa31a; text-decoration: none; font-weight: bold; }" +
                "p { font-size: 16px; color: #555; }" +
                ".btn { display: inline-block; background-color: #ffa31a; color: white; padding: 10px 20px; border-radius: 5px; font-size: 16px; font-weight: bold; text-decoration: none; margin-top: 10px; }" +
                ".footer { margin-top: 20px; font-size: 14px; color: #777; }" +
                "</style>" +
                "</head>" +
                "<body>" +
                "<div class='container'>" +
                "<h2>Invitation to Join " + instituteName + "</h2>" +
                "<p>Dear Student,</p>" +
                "<p>You have been invited to join <strong>" + instituteName + "</strong>. Please complete your registration by filling out the required form.</p>" +
                "<p><strong>Your unique invitation code:</strong></p>" +
                "<h3 style='color: #ffa31a;'>" + invitationCode + "</h3>" +
                "<p>Click the button below to access the registration form:</p>" +
                "<a href='" + LEARNER_INVITATION_FORM_URL + "?code=" + invitationCode + "' target='_blank' class='btn'>Complete Registration</a>" +
                "<p>This link is only valid for a limited time, so kindly complete the process at your earliest convenience.</p>" +
                "<p>If you have any questions, feel free to reach out to us.</p>" +
                "<p>Best regards,</p>" +
                "<p><strong>" + instituteName + " Team</strong></p>" +
                "<div class='footer'>This is an automated email. Please do not reply.</div>" +
                "</div>" +
                "</body>" +
                "</html>";
    }


    public static String getLearnerStatusUpdateEmailBody(String instituteName) {
        return "<!DOCTYPE html>" +
                "<html>" +
                "<head>" +
                "<style>" +
                "body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: center; background-color: #f9f9f9; }" +
                ".container { max-width: 600px; margin: 40px auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background: white; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); }" +
                "h2 { color: #ffa31a; }" +
                "a { color: #ffa31a; text-decoration: none; font-weight: bold; }" +
                "p { font-size: 16px; color: #555; }" +
                ".btn { display: inline-block; background-color: #ffa31a; color: white; padding: 10px 20px; border-radius: 5px; font-size: 16px; font-weight: bold; text-decoration: none; margin-top: 10px; }" +
                ".footer { margin-top: 20px; font-size: 14px; color: #777; }" +
                "</style>" +
                "</head>" +
                "<body>" +
                "<div class='container'>" +
                "<h2>Track Your Application Status - " + instituteName + "</h2>" +
                "<p>Dear Learner,</p>" +
                "<p>Thank you for submitting your application to <strong>" + instituteName + "</strong>. You can now track the status of your application and view any updates from the institute.</p>" +
                "<p>Click the button below to check your status:</p>" +
                "<a href='" + LEARNER_STATUS_UPDATE_CHECK_URL + "?code=' target='_blank' class='btn'>Check Application Status</a>" +
                "<p>Please keep this code safe, as you may need it for future reference.</p>" +
                "<p>If you have any questions or require assistance, feel free to reach out to us.</p>" +
                "<p>Best regards,</p>" +
                "<p><strong>" + instituteName + " Team</strong></p>" +
                "<div class='footer'>This is an automated email. Please do not reply.</div>" +
                "</div>" +
                "</body>" +
                "</html>";
    }
}

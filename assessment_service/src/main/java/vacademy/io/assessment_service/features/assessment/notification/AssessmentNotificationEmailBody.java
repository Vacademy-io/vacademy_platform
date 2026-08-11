package vacademy.io.assessment_service.features.assessment.notification;

public class AssessmentNotificationEmailBody {

    /**
     * Body for the assessment-report email. The report travels as a PDF attachment —
     * {@code AssessmentReportNotificationService} supplies only {@code learner_name}, so any
     * other placeholder here ships to the learner literally. This template used to carry a
     * "Download Report" button pointing at {@code href="{{report_link}}"} and a support link
     * at {@code href="{{support_link}}"}; neither was ever populated, and there is no report
     * URL to populate the first one with. Both are gone — do not reintroduce a placeholder
     * without wiring a value for it in the sender.
     */
    public static String getAssessmentReportBody() {
        return """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <title>Assessment Report</title>
                </head>
                <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 40px;">
                    <table align="center" width="600" style="background: white; border-radius: 12px; box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1); padding: 20px; border-collapse: collapse;">
                        <tr>
                            <td align="center" style="background: #e06623; padding: 18px; border-radius: 12px 12px 0 0;">
                                <h2 style="color: white; margin: 0; font-size: 24px;">📄 Assessment Report</h2>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 25px; text-align: left; color: #333; line-height: 1.6;">
                                <p style="font-size: 18px; font-weight: bold;">Dear {{learner_name}},</p>
                                <p>We are pleased to share your assessment report. Your performance and feedback are detailed in the attached document.</p>
                                <p>For any questions, feel free to reach out. We appreciate your dedication to learning! 🚀</p>
                                <div style="text-align: center; margin-top: 20px; padding: 12px 24px; background: #fdf2ec; border-radius: 6px; font-size: 16px; font-weight: bold; color: #e06623;">📎 Your report is attached to this email as report.pdf</div>
                            </td>
                        </tr>
                        <tr>
                            <td style="background: #f8f8f8; padding: 15px; text-align: center; font-size: 14px; color: #666; border-radius: 0 0 12px 12px;">
                                <p>Need help? Just reply to this email.</p>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
                """;
    }
}

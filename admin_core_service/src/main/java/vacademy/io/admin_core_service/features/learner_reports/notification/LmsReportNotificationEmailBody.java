package vacademy.io.admin_core_service.features.learner_reports.notification;

import vacademy.io.admin_core_service.features.learner_reports.dto.AvgDailyTimeSpentDTO;
import vacademy.io.admin_core_service.features.learner_reports.dto.ProgressReportDTO;
import vacademy.io.admin_core_service.features.learner_reports.dto.SlideProgressDTO;

import java.util.function.Function;

public class LmsReportNotificationEmailBody {

    private static final String TEMPLATE = """
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>%s</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: #f4f4f4;
              color: #333;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background-color: #fff;
              border: 2px solid hsl(24, 85%%, 54%%);
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            }
            .header {
              background-color: hsl(24, 85%%, 54%%);
              color: #fff;
              padding: 20px;
              font-size: 20px;
              text-align: center;
            }
            .content {
              padding: 24px;
            }
            .content p {
              margin-bottom: 16px;
            }
            .report-info {
              background-color: #fff8f2;
              border: 1px solid hsl(24, 85%%, 54%%);
              border-radius: 8px;
              padding: 16px;
              margin-top: 12px;
            }
            .report-info strong {
              color: hsl(24, 85%%, 54%%);
            }
            .footer {
              font-size: 12px;
              color: #888;
              text-align: center;
              padding: 16px;
              border-top: 1px solid #eee;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">%s</div>
            <div class="content">
              <p>%s</p>
              <div class="report-info">
                <strong>Report Type:</strong> %s<br>
                <strong>Report Date:</strong> %s<br>
              </div>
              <p>Please review the attached PDF to see your detailed progress and performance.</p>
            </div>
            <div class="footer">
              This is an automated message. For questions, contact support.
            </div>
          </div>
        </body>
        </html>
        """;

    public static String buildEmailBody(String subject, String heading, String message, String reportType, String reportDate) {
        return TEMPLATE.formatted(subject, heading, message, reportType, reportDate);
    }


    public static String buildEmailBodyForLearnerProgressReport(
            String learnerName,
            String batchName,
            String instituteName,
            String reportType,
            String dateGenerated,
            ProgressReportDTO batchProgressReport,
            ProgressReportDTO learnerProgressReport,
            SlideProgressDTO slideProgress) {

        double learnerCourse = learnerProgressReport.getPercentageCourseCompleted() != null ? learnerProgressReport.getPercentageCourseCompleted() : 0.0;
        double learnerTime = learnerProgressReport.getAvgTimeSpentInMinutes() != null ? learnerProgressReport.getAvgTimeSpentInMinutes() : 0.0;
        double learnerScore = learnerProgressReport.getPercentageConcentrationScore() != null ? learnerProgressReport.getPercentageConcentrationScore() : 0.0;

        double batchCourse = batchProgressReport.getPercentageCourseCompleted() != null ? batchProgressReport.getPercentageCourseCompleted() : 0.0;
        double batchTime = batchProgressReport.getAvgTimeSpentInMinutes() != null ? batchProgressReport.getAvgTimeSpentInMinutes() : 0.0;
        double batchScore = batchProgressReport.getPercentageConcentrationScore() != null ? batchProgressReport.getPercentageConcentrationScore() : 0.0;

        Function<Double, String> formatTime = minutes -> {
            int hrs = (int) (minutes / 60);
            int min = (int) (minutes % 60);
            return String.format("%dh %02dm", hrs, min);
        };

        StringBuilder tableRows = new StringBuilder();
        if (learnerProgressReport.getDailyTimeSpent() != null && batchProgressReport.getDailyTimeSpent() != null) {
            int size = Math.max(learnerProgressReport.getDailyTimeSpent().size(), batchProgressReport.getDailyTimeSpent().size());
            for (int i = 0; i < size; i++) {
                String date = "";
                String learnerTimeSpent = "0h 00m";
                String batchTimeSpent = "0h 00m";

                if (i < learnerProgressReport.getDailyTimeSpent().size()) {
                    AvgDailyTimeSpentDTO l = learnerProgressReport.getDailyTimeSpent().get(i);
                    date = l.getActivityDate();
                    learnerTimeSpent = formatTime.apply(l.getAvgDailyTimeMinutes() != null ? l.getAvgDailyTimeMinutes() : 0.0);
                }

                if (i < batchProgressReport.getDailyTimeSpent().size()) {
                    AvgDailyTimeSpentDTO b = batchProgressReport.getDailyTimeSpent().get(i);
                    batchTimeSpent = formatTime.apply(b.getAvgDailyTimeMinutes() != null ? b.getAvgDailyTimeMinutes() : 0.0);
                }

                tableRows.append(String.format("<tr><td>%s</td><td>%s</td><td>%s</td></tr>", date, learnerTimeSpent, batchTimeSpent));
            }
        }

        return String.format("""
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <title>Learner Report</title>
              <style>
                body {
                  font-family: 'Arial', sans-serif;
                  background: #f7f7f7;
                  padding: 30px;
                  color: #4B4B4B;
                  font-size: 13px;
                }
                h2 {
                  color: #d95d39;
                  margin-top: 30px;
                }
                .header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                }
                .btn {
                  padding: 6px 14px;
                  background: #fff;
                  border: 1px solid #ccc;
                  border-radius: 6px;
                  font-size: 12px;
                  cursor: pointer;
                }
                hr {
                  border: none;
                  border-top: 1px solid #ddd;
                  margin: 25px 0;
                }
                .summary-section {
                  display: grid;
                  grid-template-columns: repeat(3, 1fr);
                  gap: 20px;
                  background: white;
                  padding: 20px;
                  border-radius: 10px;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
                }
                .summary-block {
                  text-align: center;
                }
                .summary-block strong {
                  display: block;
                  font-size: 13px;
                  font-weight: 600;
                  margin-bottom: 5px;
                }
                .summary-block span {
                  font-size: 14px;
                  font-weight: bold;
                  color: #8E8E8E;
                }
                .performance-table {
                  width: 100%;
                  display: flex;
                  justify-content: center;
                }
                .performance-table table {
                  border-collapse: collapse;
                  width: 60%%;
                  background: white;
                  border-radius: 8px;
                  overflow: hidden;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
                }
                .performance-table th, .performance-table td {
                  padding: 10px;
                  text-align: left;
                  border-bottom: 1px solid #eee;
                  color: #4B4B4B;
                  font-size: 13px;
                }
                .performance-table th {
                  background: #FDEDD7;
                }
              </style>
            </head>
            <body>
              <div class="header">
                <h2>%s</h2>
                <div>
                  <button class="btn">Report Type: %s</button>
                </div>
              </div>
              <p><strong>Institute:</strong> %s<br>
              <strong>Batch:</strong> %s<br>
              <strong>Date Range:</strong> %s</p>

              <hr>

              <div class="summary-section">
                <div class="summary-block">
                  <strong>Course Completed</strong>
                  <span>%.2f%%</span>
                </div>
                <div class="summary-block">
                  <strong>Daily Time spent (Avg)</strong>
                  <span>%s</span>
                </div>
                <div class="summary-block">
                  <strong>Concentration score (Avg)</strong>
                  <span>%.2f%%</span>
                </div>
                <div class="summary-block">
                  <strong>Course Completed by batch</strong>
                  <span>%.2f%%</span>
                </div>
                <div class="summary-block">
                  <strong>Daily Time spent by batch (Avg)</strong>
                  <span>%s</span>
                </div>
                <div class="summary-block">
                  <strong>Concentration score of batch (Avg)</strong>
                  <span>%.2f%%</span>
                </div>
              </div>

              <hr>

              <h2 style="text-align:center;">Daily Learning Performance</h2>
              <div class="performance-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time Spent</th>
                      <th>Time Spent by batch (Avg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    %s
                  </tbody>
                </table>
              </div>
            </body>
            </html>
            """,
                learnerName,
                reportType,
                instituteName,
                batchName,
                dateGenerated,
                learnerCourse,
                formatTime.apply(learnerTime),
                learnerScore,
                batchCourse,
                formatTime.apply(batchTime),
                batchScore,
                tableRows
        );
    }

}

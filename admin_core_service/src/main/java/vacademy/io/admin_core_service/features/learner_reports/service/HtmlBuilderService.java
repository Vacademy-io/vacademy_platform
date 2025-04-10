package vacademy.io.admin_core_service.features.learner_reports.service;

import vacademy.io.admin_core_service.features.learner_reports.dto.AvgDailyTimeSpentDTO;
import vacademy.io.admin_core_service.features.learner_reports.dto.ProgressReportDTO;
import vacademy.io.admin_core_service.features.learner_reports.dto.SlideProgressDTO;
import vacademy.io.admin_core_service.features.learner_reports.dto.SlideProgressDateWiseDTO;

import java.text.SimpleDateFormat;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.function.Function;
import java.util.stream.Collectors;

public class HtmlBuilderService {

    public static String buildStyledHtmlReport(String heading, String batchName, String instituteName, String dateRange,
                                               String courseCompleted, Double avgTimeSpent, String concentrationScore,
                                               List<AvgDailyTimeSpentDTO> dailyData) {

        String tableRows = dailyData.stream()
                .map(entry -> String.format("""
        <tr>
          <td>%s</td>
          <td>%s</td>
        </tr>
        """,
                        formatIsoDateToReadable(entry.getActivityDate()),
                        formatMinutesToHrMin(entry.getAvgDailyTimeMinutes())))
                .collect(Collectors.joining());

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
      color: #333;
      margin-top: 30px;
      text-align: center;
    }
    .header-details {
      text-align: center;
      margin-bottom: 20px;
    }
    .header-details strong {
      color: #333;
    }
    .performance-table {
      width: 100%%;
      display: flex;
      justify-content: center;
      margin-top: 20px;
    }
    .performance-table table {
      border-collapse: collapse;
      width: 80%%;
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

  <div class="header-details">
    <h2>%s</h2>
    <p><strong>Institute:</strong> %s<br>
       <strong>Batch:</strong> %s<br>
       <strong>Date Range:</strong> %s</p>
  </div>

  <h2>Summary</h2>
  <div class="performance-table">
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Course Completed</td>
          <td>%.2f%%</td>
        </tr>
        <tr>
          <td>Daily Time spent (Avg)</td>
          <td>%s</td>
        </tr>
        <tr>
          <td>Concentration score (Avg)</td>
          <td>%.2f%%</td>
        </tr>
      </tbody>
    </table>
  </div>

  <h2>Daily Learning Performance</h2>
  <div class="performance-table">
    <table>
      <thead>
        <tr>
          <th>Date</th>
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
                heading,                      // %s for <h2>
                instituteName,               // %s for institute
                batchName,                   // %s for batch
                dateRange,                   // %s for date range
                Double.parseDouble(courseCompleted), // %.2f for course %
                formatMinutesToHrMin(avgTimeSpent),  // %s for avg time
                Double.parseDouble(concentrationScore), // %.2f for concentration score
                tableRows                    // %s for dynamic daily data
        );
    }



    private static String formatMinutesToHrMin(Double minutes) {
        if (minutes ==  null){
            return "0.0";
        }
        int hrs = (int) (minutes / 60);
        int mins = (int) (minutes % 60);
        return String.format("%dh %02dm", hrs, mins);
    }

    private static final Function<Double, String> formatTime = minutes -> {
        int hrs = (int) (minutes / 60);
        int min = (int) (minutes % 60);
        return String.format("%d hr %02d min", hrs, min);
    };

    public static String buildEmailBodyForLearnerProgressReport(
            String heading,
            String learnerName,
            String instituteName,
            String batchName,
            String dateGenerated,
            ProgressReportDTO batchProgressReport,
            ProgressReportDTO learnerProgressReport,
            List<SlideProgressDateWiseDTO> slideProgress) {

        double learnerCourse = getOrDefault(learnerProgressReport.getPercentageCourseCompleted());
        double learnerTime = getOrDefault(learnerProgressReport.getAvgTimeSpentInMinutes());
        double learnerScore = getOrDefault(learnerProgressReport.getPercentageConcentrationScore());

        double batchCourse = getOrDefault(batchProgressReport.getPercentageCourseCompleted());
        double batchTime = getOrDefault(batchProgressReport.getAvgTimeSpentInMinutes());
        double batchScore = getOrDefault(batchProgressReport.getPercentageConcentrationScore());

        String avgTimeSpentTable = buildAvgTimeSpentTable(
                learnerProgressReport.getDailyTimeSpent(),
                batchProgressReport.getDailyTimeSpent()
        );

        String slideWiseProgressTable = buildSlideWiseProgress(slideProgress);

        return String.format(getHtmlTemplate(),
                instituteName, batchName, learnerName, dateGenerated,
                learnerCourse, batchCourse,
                formatTime.apply(learnerTime), formatTime.apply(batchTime),
                learnerScore, batchScore,
                avgTimeSpentTable, slideWiseProgressTable
        );
    }

    private static double getOrDefault(Double value) {
        return value != null ? value : 0.0;
    }

    private static String buildAvgTimeSpentTable(List<AvgDailyTimeSpentDTO> learnerList, List<AvgDailyTimeSpentDTO> batchList) {
        StringBuilder rows = new StringBuilder();

        SimpleDateFormat inputFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX");
        SimpleDateFormat outputFormat = new SimpleDateFormat("dd MMM yyyy");

        if (learnerList != null && !learnerList.isEmpty()) {
            for (int i = 0; i < learnerList.size(); i++) {
                AvgDailyTimeSpentDTO learner = learnerList.get(i);
                AvgDailyTimeSpentDTO batch = (batchList != null && batchList.size() > i) ? batchList.get(i) : null;

                String formattedDate = "-";
                try {
                    Date parsedDate = inputFormat.parse(learner.getActivityDate());
                    formattedDate = outputFormat.format(parsedDate);
                } catch (Exception e) {
                    e.printStackTrace();
                }

                rows.append(String.format("""
                <tr>
                  <td>%s</td>
                  <td>%s</td>
                  <td>%s</td>
                </tr>
                """,
                        formattedDate,
                        formatTime.apply(learner.getAvgDailyTimeMinutes()),
                        batch != null ? formatTime.apply(batch.getAvgDailyTimeMinutes()) : "-"
                ));
            }
        } else {
            rows.append("""
            <tr>
              <td colspan="3" style="text-align:center;">No data found</td>
            </tr>
            """);
        }

        return rows.toString();
    }


    private static String buildSlideWiseProgress(List<SlideProgressDateWiseDTO> slideProgress) {
        StringBuilder rows = new StringBuilder();
        if (slideProgress != null && !slideProgress.isEmpty()) {
            for (SlideProgressDateWiseDTO day : slideProgress) {
                for (SlideProgressDTO slide : day.getSlideDetails()) {
                    rows.append(String.format("""
                        <tr>
                          <td>%s<br><small>%s > %s > %s</small></td>
                          <td>%s</td>
                          <td>%.2f%%</td>
                          <td>%s</td>
                        </tr>
                        """,
                            slide.getSlideTitle(),
                            slide.getSubjectName(),
                            slide.getModuleName(),
                            slide.getChapterName(),
                            day.getDate(),
                            slide.getConcentrationScore(),
                            slide.getTimeSpent()));
                }
            }
        } else {
            rows.append("""
                <tr>
                  <td colspan="4" style="text-align:center;">No slide progress data found</td>
                </tr>
                """);
        }

        return rows.toString();
    }

    private static String getHtmlTemplate() {
        return """
        <!DOCTYPE html>
        <html lang="en">
        <head>
        <meta charset="UTF-8">
        <title>Learner Report</title>
        <style>
            body {
              font-family: 'Georgia', serif;
              background-color: #f8f8f8;
              margin: 0;
              padding: 40px;
              color: #333;
            }

            .container {
              max-width: 800px;
              margin: auto;
              background: #fff;
              padding: 40px 50px;
              box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            }

            h1, h2 {
              text-align: center;
              color: #222;
            }

            h1 {
              font-size: 28px;
              margin-bottom: 30px;
            }

            h2 {
              font-size: 22px;
              margin-top: 40px;
              margin-bottom: 20px;
            }

            .details p {
              font-size: 16px;
              margin: 4px 0;
            }

            .details b {
              font-weight: bold;
            }

            .details {
              text-align: center;
              margin-bottom: 30px;
            }

            table {
              width: 100%%;
              border-collapse: collapse;
              margin-bottom: 30px;
              font-size: 16px;
            }

            thead th {
              background-color: #fcedda;
              text-align: left;
              padding: 12px;
              font-weight: bold;
            }

            tbody td {
              background-color: #ffffff;
              padding: 12px;
              border-bottom: 1px solid #ddd;
            }

            .daily-table th {
              background-color: #fcedda;
            }

            .daily-table td {
              background-color: #fff;
            }
        </style>
        </head>
        <body>

        <div class="header-details">
          <h2>Progress Report</h2>
          <p><strong>Institute:</strong> %s<br>
             <strong>Batch:</strong> %s<br>
             <strong>Learner Name:</strong> %s<br>
             <strong>Date Range:</strong> %s</p>
        </div>

        <h2>Summary Comparison</h2>
        <div class="performance-table">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Learner</th>
                <th>Batch</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Course Completed</td>
                <td>%.2f%%</td>
                <td>%.2f%%</td>
              </tr>
              <tr>
                <td>Daily Time spent (Avg)</td>
                <td>%s</td>
                <td>%s</td>
              </tr>
              <tr>
                <td>Concentration score (Avg)</td>
                <td>%.2f%%</td>
                <td>%.2f%%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>Daily Learning Performance</h2>
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

        <h2>Slide-wise Progress</h2>
        <div class="performance-table">
          <table>
            <thead>
              <tr>
                <th>Slide Name</th>
                <th>Last Accessed</th>
                <th>Completion</th>
                <th>Time Spent</th>
              </tr>
            </thead>
            <tbody>
              %s
            </tbody>
          </table>
        </div>

        </body>
        </html>
        """;
    }

    public static String formatIsoDateToReadable(String isoDate) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH)
                .withZone(ZoneId.of("UTC"));
        return formatter.format(Instant.parse(isoDate));
    }

}

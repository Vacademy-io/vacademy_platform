package vacademy.io.admin_core_service.features.learner_reports.service;

import vacademy.io.admin_core_service.features.learner_reports.dto.*;

import java.text.SimpleDateFormat;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.function.Function;
import java.util.stream.Collectors;

public class HtmlBuilderService {

    private static final Function<Double, String> formatTime = minutes -> {
        int hrs = (int) (minutes / 60);
        int min = (int) (minutes % 60);
        return String.format("%d hr %02d min", hrs, min);
    };

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
        if (minutes == null) {
            return "0.0";
        }
        int hrs = (int) (minutes / 60);
        int mins = (int) (minutes % 60);
        return String.format("%dh %02dm", hrs, mins);
    }

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


    public static String buildStyledHtmlReport(
            String heading, String batchName, String instituteName, String dateRange,
            ProgressReportDTO progressReportDTO,
            List<LearnerActivityDataProjection> learnerActivityData) {

        // Extracting data from DTO
        Double courseCompleted = progressReportDTO.getPercentageCourseCompleted();
        Double avgTimeSpent = progressReportDTO.getAvgTimeSpentInMinutes();
        Double concentrationScore = progressReportDTO.getPercentageConcentrationScore();
        List<AvgDailyTimeSpentDTO> dailyData = progressReportDTO.getDailyTimeSpent();

        // Daily data rows
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

        // Leaderboard rows
        String leaderboardRows = learnerActivityData.stream()
                .sorted(Comparator.comparing(LearnerActivityDataProjection::getRank))
                .map(entry -> String.format("""
                                <tr>
                                  <td>%d</td>
                                  <td>%s</td>
                                  <td>%.2f%%</td>
                                  <td>%s</td>
                                  <td>%s</td>
                                </tr>
                                """,
                        entry.getRank(),
                        entry.getFullName(),
                        entry.getAvgConcentration(),
                        formatMinutesToDayHrMin(entry.getDailyAvgTime()),
                        formatMinutesToDayHrMin(entry.getTotalTime())))
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
                              width: 90%%;
                              background: white;
                              border-radius: 12px;
                              overflow: hidden;
                              box-shadow: 0 2px 6px rgba(0,0,0,0.05);
                            }
                            .performance-table th, .performance-table td {
                              padding: 12px 14px;
                              text-align: left;
                              border-bottom: 1px solid #eee;
                              color: #4B4B4B;
                            }
                            .performance-table th {
                              background: #FDEDD7;
                              font-weight: bold;
                            }
                            .daily-performance-section, .leaderboard-section {
                              page-break-inside: avoid;
                            }
                            .leaderboard-section {
                              margin-top: 40px;
                            }
                            .leaderboard-title {
                              color: #f4731c;
                              font-weight: bold;
                              font-size: 16px;
                              margin-bottom: 10px;
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

                          <div class="daily-performance-section">
                            <div class="performance-table">
                              <table>
                                <thead>
                                  <tr>
                                    <th colspan="2" style="background: #ffffff; color: #333; font-weight: bold; font-size: 18px; text-align: center; border-bottom: none;">
                                      Daily Learning Performance
                                    </th>
                                  </tr>
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
                          </div>

                          <div class="leaderboard-section">
                            <div class="performance-table">
                              <table>
                                <thead>
                                  <tr>
                                    <th colspan="5" style="background: #ffffff; color: #f4731c; font-weight: bold; font-size: 16px; text-align: left; border-bottom: none;">
                                      Leaderboard
                                    </th>
                                  </tr>
                                  <tr>
                                    <th>Rank</th>
                                    <th>Student Name</th>
                                    <th>Concentration Score</th>
                                    <th>Daily Time Spent (Avg.)</th>
                                    <th>Total Time</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  %s
                                </tbody>
                              </table>
                            </div>
                          </div>

                        </body>
                        </html>
                        """,
                heading,
                instituteName,
                batchName,
                dateRange,
                courseCompleted,
                formatMinutesToHrMin(avgTimeSpent),
                concentrationScore,
                tableRows,
                leaderboardRows
        );
    }


    public static String formatMinutesToDayHrMin(Double totalMinutes) {

      if (totalMinutes == null || totalMinutes <= 0) {
          return "0m";
      }
  
  
      int days = (int) (totalMinutes / (24 * 60));
  
      int remainingAfterDays = (int) (totalMinutes % (24 * 60));
  
      int hours = (int) (remainingAfterDays / 60);
  
      int minutes = (int) (remainingAfterDays % 60);
  
      StringBuilder result = new StringBuilder();
  
      if (days > 0) result.append(days).append("d ");
      if (hours > 0) result.append(hours).append("h ");
      if (minutes > 0 || result.length() == 0) result.append(minutes).append("m");
  
      return result.toString().trim();
  }
  

    public static String generateHtmlForLearnerReport(
            ProgressReportDTO learnerProgressReport,
            ProgressReportDTO batchProgressReport,
            List<SlideProgressDateWiseDTO> slideProgressDateWise,
            String instituteName,
            String batchName,
            String dateRange,
            String learnerName) {

        double learnerCourse = getOrDefault(learnerProgressReport.getPercentageCourseCompleted());
        double batchCourse = getOrDefault(batchProgressReport.getPercentageCourseCompleted());
        double learnerConcentration = getOrDefault(learnerProgressReport.getPercentageConcentrationScore());
        double batchConcentration = getOrDefault(batchProgressReport.getPercentageConcentrationScore());
        String learnerTime = formatMinutesToHrMin(learnerProgressReport.getAvgTimeSpentInMinutes());
        String batchTime = formatMinutesToHrMin(batchProgressReport.getAvgTimeSpentInMinutes());

        StringBuilder slideSections = new StringBuilder();
        for (SlideProgressDateWiseDTO dateWise : slideProgressDateWise) {
            slideSections.append(String.format("""
                    <div class="date-section">
                      <div class="date-title">Date: %s</div>
                      <table>
                        <thead>
                          <tr>
                            <th>Slide Title</th>
                            <th>Chapter</th>
                            <th>Module</th>
                            <th>Subject</th>
                            <th>Concentration Score</th>
                            <th>Time Spent</th>
                          </tr>
                        </thead>
                        <tbody>
                    """, escapeHtml(dateWise.getDate())));

            if (dateWise.getSlideDetails() != null) {
                for (SlideProgressDTO slide : dateWise.getSlideDetails()) {
                    String formattedTime = formatTimeSpentString(slide.getTimeSpent());
                    String slideTitle = truncate(slide.getSlideTitle(), 40);
                    String chapterName = slide.getChapterName() != null ? slide.getChapterName() : "-";
                    String moduleName = slide.getModuleName() != null ? slide.getModuleName() : "-";
                    String subjectName = slide.getSubjectName() != null ? slide.getSubjectName() : "-";

                    slideSections.append(String.format("""
                                    <tr>
                                      <td>%s</td>
                                      <td>%s</td>
                                      <td>%s</td>
                                      <td>%s</td>
                                      <td>%.2f%%</td>
                                      <td>%s</td>
                                    </tr>
                                    """,
                            escapeHtml(slideTitle),
                            escapeHtml(chapterName),
                            escapeHtml(moduleName),
                            escapeHtml(subjectName),
                            slide.getConcentrationScore(),
                            escapeHtml(formattedTime)
                    ));
                }
            }

            slideSections.append("</tbody></table></div>");
        }

        return String.format(getHtmlTemplateForLearnerSlideProgress(),
                escapeHtml(instituteName),
                escapeHtml(batchName),
                escapeHtml(learnerName),
                escapeHtml(dateRange),
                learnerCourse,
                batchCourse,
                learnerTime,
                batchTime,
                learnerConcentration,
                batchConcentration,
                slideSections.toString()
        );
    }

    private static String getHtmlTemplateForLearnerSlideProgress() {
        return """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                <meta charset="UTF-8">
                <title>Learner Report</title>
                <style>
                    body {
                      font-family: 'Arial', sans-serif;
                      background-color: #fff;
                      margin: 0;
                      padding: 10px 15px;
                      color: #333;
                    }

                    .container {
                      width: 100%%;
                      margin: 0;
                      padding: 0;
                    }

                    h1, h2 {
                      text-align: center;
                      color: #222;
                    }

                    h1 {
                      font-size: 24px;
                      margin-bottom: 20px;
                    }

                    h2 {
                      font-size: 18px;
                      margin-top: 30px;
                      margin-bottom: 15px;
                    }

                    .details {
                      text-align: center;
                      margin-bottom: 25px;
                      font-size: 13px;
                    }

                    .details p {
                      margin: 3px 0;
                    }

                    table {
                      width: 100%%;
                      border-collapse: collapse;
                      margin: 0 auto 20px auto;
                      font-size: 10px;
                    }

                    thead th {
                      background-color: #fcedda;
                      text-align: left;
                      padding: 5px 6px;
                      font-weight: bold;
                      border: 1px solid #e0e0e0;
                      white-space: nowrap;
                    }

                    tbody td {
                      background-color: #ffffff;
                      padding: 5px 6px;
                      border: 1px solid #e0e0e0;
                      overflow: hidden;
                      white-space: nowrap;
                    }

                    tbody tr {
                      page-break-inside: avoid;
                    }

                    .date-section {
                      margin-top: 25px;
                    }

                    .date-title {
                      font-size: 14px;
                      font-weight: bold;
                      margin-bottom: 8px;
                      color: #f57c00;
                    }
                </style>
                </head>
                <body>
                <div class="container">
                  <h1>Learner Progress Report</h1>

                  <div class="details">
                    <p><b>Institute:</b> %s</p>
                    <p><b>Batch:</b> %s</p>
                    <p><b>Learner Name:</b> %s</p>
                    <p><b>Date Range:</b> %s</p>
                  </div>

                  <h2>Summary Comparison</h2>
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
                        <td>Daily Time Spent (Avg)</td>
                        <td>%s</td>
                        <td>%s</td>
                      </tr>
                      <tr>
                        <td>Concentration Score (Avg)</td>
                        <td>%.2f%%</td>
                        <td>%.2f%%</td>
                      </tr>
                    </tbody>
                  </table>

                  <h2>Slide-wise Progress (Date-wise)</h2>
                  %s
                </div>
                </body>
                </html>
                """;
    }

    public static String getSubjectWiseProgressReportHtml(List<LearnerSubjectWiseProgressReportDTO> subjectWiseProgress,
                                                          String learnerName,
                                                          String batchName,
                                                          String instituteName) {
        StringBuilder html = new StringBuilder();

        html.append("<div style='font-family: Georgia, serif; background-color: #f8f8f8; padding: 40px; color: #333;'>");

        // Container
        html.append("<div style='max-width: 800px; margin: auto; background: #fff; padding: 40px 50px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);'>");

        // Heading
        html.append("<h2 style='text-align: center; font-size: 28px; color: #222; margin-bottom: 30px;'>Progress Report</h2>");

        // Details
        html.append("<div style='text-align: center; font-size: 16px; margin-bottom: 30px;'>")
                .append("<p><strong>Institute:</strong> ").append(instituteName).append("</p>")
                .append("<p><strong>Batch:</strong> ").append(batchName).append("</p>")
                .append("<p><strong>Learner Name:</strong> ").append(learnerName).append("</p>")
                .append("</div>");

        // Section Heading
        html.append("<h2 style='text-align: center; font-size: 22px; color: #222; margin-top: 40px; margin-bottom: 20px;'>Subject-wise Overview</h2>");

        // Table
        html.append("<table style='width: 100%; border-collapse: collapse; font-size: 16px; margin-bottom: 30px;'>");
        html.append("<thead>")
                .append("<tr style='background-color: #fcedda;'>")
                .append("<th style='text-align: left; padding: 12px;'>Subject</th>")
                .append("<th style='text-align: left; padding: 12px;'>Module</th>")
                .append("<th style='text-align: left; padding: 12px;'>Module Completed</th>")
                .append("<th style='text-align: left; padding: 12px;'>Daily Time Spent (Avg)</th>")
                .append("</tr>")
                .append("</thead><tbody>");

        for (LearnerSubjectWiseProgressReportDTO subject : subjectWiseProgress) {
            String subjectName = subject.getSubjectName();
            List<LearnerSubjectWiseProgressReportDTO.ModuleProgressDTO> modules = subject.getModules();

            for (int i = 0; i < modules.size(); i++) {
                LearnerSubjectWiseProgressReportDTO.ModuleProgressDTO module = modules.get(i);
                html.append("<tr>")
                        .append("<td style='padding: 12px; border-bottom: 1px solid #ddd;'>")
                        .append(i == 0 ? subjectName : "")
                        .append("</td>")
                        .append("<td style='padding: 12px; border-bottom: 1px solid #ddd;'>")
                        .append(module.getModuleName())
                        .append("</td>")
                        .append("<td style='padding: 12px; border-bottom: 1px solid #ddd;'>")
                        .append(String.format("%.2f%%", module.getCompletionPercentage()))
                        .append("</td>")
                        .append("<td style='padding: 12px; border-bottom: 1px solid #ddd;'>")
                        .append(module.getAvgTimeSpentMinutes() == 0 ? "0 min" : String.format("%.0f min", module.getAvgTimeSpentMinutes()))
                        .append("</td>")
                        .append("</tr>");
            }
        }

        html.append("</tbody></table></div></div>"); // Close table, container, and outer div
        return html.toString();
    }

    /**
     * Builds HTML for the full learner Subject-wise Progress Report PDF with all columns:
     * Subject, Module, Module Completed, Module completed by batch,
     * Daily Time spent by batch (Avg), Daily Time spent (Avg).
     * Uses full document structure and @page margins so the header is not cut off at top of PDF.
     */
    public static String getLearnerSubjectWiseProgressReportFullHtml(List<LearnerSubjectWiseProgressReportDTO> subjectWiseProgress,
                                                                    String learnerName,
                                                                    String batchName,
                                                                    String instituteName) {
        StringBuilder html = new StringBuilder();

        // Full document wrapper with @page margins to prevent top content from being cut off in PDF
        html.append("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/>")
                .append("<style>")
                .append("@page { size: A4; margin: 20mm 15mm; }")
                .append("body { font-family: Georgia, serif; margin: 0; padding: 0; color: #333; }")
                .append("table { page-break-inside: auto; } tr { page-break-inside: avoid; page-break-after: auto; }")
                .append("</style></head><body>");

        html.append("<div style='background-color: #f8f8f8; padding: 30px 20px; min-height: 100%;'>");

        // Container
        html.append("<div style='max-width: 1000px; margin: auto; background: #fff; padding: 40px 50px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);'>");

        // Heading
        html.append("<h2 style='text-align: center; font-size: 28px; color: #222; margin: 0 0 30px 0;'>Subject-wise Progress Report</h2>");

        // Details
        html.append("<div style='text-align: center; font-size: 16px; margin-bottom: 30px;'>")
                .append("<p style='margin: 4px 0;'><strong>Institute:</strong> ").append(escapeHtml(nullToDash(instituteName))).append("</p>")
                .append("<p style='margin: 4px 0;'><strong>Batch:</strong> ").append(escapeHtml(nullToDash(batchName))).append("</p>")
                .append("<p style='margin: 4px 0;'><strong>Learner Name:</strong> ").append(escapeHtml(nullToDash(learnerName))).append("</p>")
                .append("</div>");

        // Section Heading
        html.append("<h2 style='text-align: center; font-size: 22px; color: #222; margin: 40px 0 20px 0;'>Subject-wise Overview</h2>");

        // Table with all 6 columns
        html.append("<table style='width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 30px; border: 1px solid #ddd;'>");
        html.append("<thead>")
                .append("<tr style='background-color: #fcedda;'>")
                .append("<th style='text-align: left; padding: 12px; border: 1px solid #ddd;'>Subject</th>")
                .append("<th style='text-align: left; padding: 12px; border: 1px solid #ddd;'>Module</th>")
                .append("<th style='text-align: left; padding: 12px; border: 1px solid #ddd;'>Module Completed</th>")
                .append("<th style='text-align: left; padding: 12px; border: 1px solid #ddd;'>Module completed by batch</th>")
                .append("<th style='text-align: left; padding: 12px; border: 1px solid #ddd;'>Daily Time spent by batch (Avg)</th>")
                .append("<th style='text-align: left; padding: 12px; border: 1px solid #ddd;'>Daily Time spent (Avg)</th>")
                .append("</tr>")
                .append("</thead><tbody>");

        for (LearnerSubjectWiseProgressReportDTO subject : subjectWiseProgress) {
            String subjectName = nullToDash(subject.getSubjectName());
            List<LearnerSubjectWiseProgressReportDTO.ModuleProgressDTO> modules = subject.getModules();
            if (modules == null) continue;

            for (int i = 0; i < modules.size(); i++) {
                LearnerSubjectWiseProgressReportDTO.ModuleProgressDTO module = modules.get(i);
                double completionPct = module.getCompletionPercentage() != null ? module.getCompletionPercentage() : 0.0;
                double completionByBatch = module.getCompletionPercentageByBatch() != null ? module.getCompletionPercentageByBatch() : 0.0;
                double avgTimeMins = module.getAvgTimeSpentMinutes() != null ? module.getAvgTimeSpentMinutes() : 0.0;
                double avgTimeByBatchMins = module.getAvgTimeSpentMinutesByBatch() != null ? module.getAvgTimeSpentMinutesByBatch() : 0.0;

                String moduleName = nullToDash(module.getModuleName());

                html.append("<tr>")
                        .append("<td style='padding: 12px; border: 1px solid #ddd;'>")
                        .append(i == 0 ? escapeHtml(subjectName) : "")
                        .append("</td>")
                        .append("<td style='padding: 12px; border: 1px solid #ddd;'>")
                        .append(escapeHtml(moduleName))
                        .append("</td>")
                        .append("<td style='padding: 12px; border: 1px solid #ddd;'>")
                        .append(String.format("%.2f%%", completionPct))
                        .append("</td>")
                        .append("<td style='padding: 12px; border: 1px solid #ddd;'>")
                        .append(String.format("%.2f%%", completionByBatch))
                        .append("</td>")
                        .append("<td style='padding: 12px; border: 1px solid #ddd;'>")
                        .append(formatMinutesToDurationString(avgTimeByBatchMins))
                        .append("</td>")
                        .append("<td style='padding: 12px; border: 1px solid #ddd;'>")
                        .append(formatMinutesToDurationString(avgTimeMins))
                        .append("</td>")
                        .append("</tr>");
            }
        }

        html.append("</tbody></table></div></div></body></html>");
        return html.toString();
    }

    private static String nullToDash(String value) {
        return (value == null || value.isBlank()) ? "-" : value;
    }

    /**
     * Formats minutes to duration string like "6h 15m 51s" or "2m 49s" to match frontend display.
     */
    private static String formatMinutesToDurationString(double minutes) {
        if (minutes <= 0) return "0m 0s";
        long totalSeconds = Math.round(minutes * 60);
        long days = totalSeconds / 86400;
        long remainder = totalSeconds % 86400;
        long hours = remainder / 3600;
        remainder %= 3600;
        long mins = remainder / 60;
        long secs = remainder % 60;

        StringBuilder sb = new StringBuilder();
        if (days > 0) sb.append(days).append("d ");
        if (hours > 0 || days > 0) sb.append(hours).append("h ");
        sb.append(mins).append("m ").append(secs).append("s");
        return sb.toString();
    }

    public static String getBatchSubjectWiseProgressReportHtml(List<SubjectProgressDTO> subjectWiseProgress,
                                                               String batchName,
                                                               String instituteName) {
        StringBuilder html = new StringBuilder();

        html.append("<div style='font-family: Georgia, serif; background-color: #f8f8f8; padding: 40px; color: #333;'>");

        // Container
        html.append("<div style='max-width: 800px; margin: auto; background: #fff; padding: 40px 50px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);'>");

        // Heading
        html.append("<h2 style='text-align: center; font-size: 28px; color: #222; margin-bottom: 30px;'>Batch Subject-wise Progress</h2>");

        // Details (batch + institute only, no learner)
        html.append("<div style='text-align: center; font-size: 16px; margin-bottom: 30px;'>")
                .append("<p><strong>Institute:</strong> ").append(escapeHtml(instituteName)).append("</p>")
                .append("<p><strong>Batch:</strong> ").append(escapeHtml(batchName)).append("</p>")
                .append("</div>");

        // Section Heading
        html.append("<h2 style='text-align: center; font-size: 22px; color: #222; margin-top: 40px; margin-bottom: 20px;'>Subject-wise Overview</h2>");

        // Table
        html.append("<table style='width: 100%; border-collapse: collapse; font-size: 16px; margin-bottom: 30px;'>");
        html.append("<thead>")
                .append("<tr style='background-color: #fcedda;'>")
                .append("<th style='text-align: left; padding: 12px;'>Subject</th>")
                .append("<th style='text-align: left; padding: 12px;'>Module</th>")
                .append("<th style='text-align: left; padding: 12px;'>Module Completed</th>")
                .append("<th style='text-align: left; padding: 12px;'>Time Spent (Avg)</th>")
                .append("</tr>")
                .append("</thead><tbody>");

        for (SubjectProgressDTO subject : subjectWiseProgress) {
            String subjectName = subject.getSubjectName();
            List<SubjectProgressDTO.ModuleProgressDTO> modules = subject.getModules();

            for (int i = 0; i < modules.size(); i++) {
                SubjectProgressDTO.ModuleProgressDTO module = modules.get(i);
                html.append("<tr>")
                        .append("<td style='padding: 12px; border-bottom: 1px solid #ddd;'>")
                        .append(i == 0 ? escapeHtml(subjectName) : "")
                        .append("</td>")
                        .append("<td style='padding: 12px; border-bottom: 1px solid #ddd;'>")
                        .append(escapeHtml(module.getModuleName()))
                        .append("</td>")
                        .append("<td style='padding: 12px; border-bottom: 1px solid #ddd;'>")
                        .append(module.getCompletionPercentage() == null
                                ? "0.00%"
                                : String.format("%.2f%%", module.getCompletionPercentage()))
                        .append("</td>")
                        .append("<td style='padding: 12px; border-bottom: 1px solid #ddd;'>")
                        .append(module.getAvgTimeSpentMinutes() == null
                                ? "0 min"
                                : String.format("%.2f min", module.getAvgTimeSpentMinutes()))
                        .append("</td>")
                        .append("</tr>");
            }
        }

        html.append("</tbody></table></div></div>");
        return html.toString();
    }

    public static String getModuleWiseReportHtml(List<LearnerChapterSlideProgressDTO> chapters,
                                                 String learnerName,
                                                 String dateGenerated,
                                                 String subject,
                                                 String module,
                                                 String course,
                                                 String sessionName,
                                                 String levelName) {
        String htmlTemplate = """
                <html>
                <head>
                  <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { font-size: 22px; font-weight: bold; color: #e65100; margin-bottom: 20px; }
                    .info-table { width: 100%%; margin-bottom: 20px; }
                    .info-table td { padding: 5px 10px; vertical-align: top; }
                    .chapter-title { font-size: 16px; font-weight: bold; color: #f57c00; margin: 20px 0 10px; }
                    table { border-collapse: collapse; width: 100%%; margin-bottom: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #fde7cc; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .icon { text-align: center; }
                  </style>
                </head>
                <body>
                  <div class='header'>Module Detail Report</div>

                  <table class='info-table'>
                    <tr>
                      <td><strong>Name:</strong> %s</td>
                      <td><strong>Date:</strong> %s</td>
                    </tr>
                    <tr>
                      <td><strong>Course:</strong> %s</td>
                      <td><strong>Session:</strong> %s</td>
                    </tr>
                    <tr>
                      <td><strong>Subject:</strong> %s</td>
                      <td><strong>Module:</strong> %s</td>
                    </tr>
                    <tr>
                      <td colspan="2"><strong>Level:</strong> %s</td>
                    </tr>
                  </table>

                  %s

                </body>
                </html>
                """;

        StringBuilder chapterTables = new StringBuilder();

        for (LearnerChapterSlideProgressDTO chapter : chapters) {
            chapterTables.append("<div class='chapter-title'>Chapter&nbsp;&nbsp;<span style='color: #e65100;'>")
                    .append(escapeHtml(chapter.getChapterName()))
                    .append("</span></div>");

            chapterTables.append("""
                    <table>
                      <thead>
                        <tr>
                          <th class="icon">▶️</th>
                          <th>Study Slide</th>
                          <th>Concentration Score</th>
                          <th>Batch Concentration Score (Avg)</th>
                          <th>Time spent</th>
                          <th>Last Active</th>
                        </tr>
                      </thead>
                      <tbody>
                    """);

           // ... inside getModuleWiseReportHtml, in the for (LearnerChapterSlideProgressDTO chapter : chapters) loop ...

        for (LearnerChapterSlideProgressDTO.SlideProgressDTO slide : chapter.getSlides()) {
          chapterTables.append("<tr>");
          chapterTables.append("<td class='icon'>▶️</td>");
          chapterTables.append("<td>").append(escapeHtml(slide.getSlideTitle())).append("</td>");
          chapterTables.append("<td>").append(formatPercentage(slide.getAvgConcentrationScore())).append("</td>");

          // use batch concentration from DTO instead of hardcoded placeholder
          chapterTables.append("<td>")
                  .append(formatBatchConcentration(slide.getAvgConcentrationScoreByBatch()))
                  .append("</td>");

          chapterTables.append("<td>").append(formatDuration(slide.getAvgTimeSpent())).append("</td>");

          // use last active from DTO instead of hardcoded placeholder
          chapterTables.append("<td>")
                  .append(escapeHtml(slide.getLastActiveDate()))
                  .append("</td>");

          chapterTables.append("</tr>");
        }

            chapterTables.append("</tbody></table>");
        }

        return String.format(htmlTemplate,
                escapeHtml(learnerName),
                escapeHtml(dateGenerated),
                escapeHtml(course),
                escapeHtml(sessionName),
                escapeHtml(subject),
                escapeHtml(module),
                escapeHtml(levelName),
                chapterTables.toString());
    }

    private static String formatPercentage(Double val) {
        return val == null ? "N/A" : String.format("%.2f%%", val);
    }

    private static String formatDuration(Double minutes) {
        if (minutes == null) return "N/A";
        int totalMinutes = minutes.intValue();
        int hours = totalMinutes / 60;
        int mins = totalMinutes % 60;
        return hours + "h " + mins + "m";
    }

    private static String truncate(String text, int maxLen) {
        if (text == null || text.isBlank()) return "-";
        return text.length() > maxLen ? text.substring(0, maxLen) + "..." : text;
    }

    private static String formatTimeSpentString(String timeSpent) {
        if (timeSpent == null || timeSpent.isBlank()) return "0m 0s";
        try {
            double totalMinutes = Double.parseDouble(timeSpent);
            if (totalMinutes <= 0) return "0m 0s";
            int mins = (int) totalMinutes;
            int secs = (int) Math.round((totalMinutes - mins) * 60);
            if (secs == 60) { mins++; secs = 0; }
            return mins + "m " + secs + "s";
        } catch (NumberFormatException e) {
            return timeSpent;
        }
    }

    private static String escapeHtml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    // Placeholder for batch concentration
   // remove or comment out these old placeholders:
// private static Double getBatchAvgConcentration(String chapter, String slide) {
//     // Replace with real logic
//     return 72.16;
// }
//
// private static String getLastActiveDate(String chapter, String slide) {
//     // Replace with actual date logic
//     return "13/10/2024, 11:00 AM";
// }

private static String formatBatchConcentration(String value) {
  if (value == null || value.isBlank()) {
      return "N/A";
  }
  try {
      double d = Double.parseDouble(value);
      return String.format("%.2f%%", d);
  } catch (NumberFormatException ex) {
      // if DB already returns a formatted string, just escape and return it
      return escapeHtml(value);
  }
}

    public static String getBatchChapterWiseReportHtml(List<ChapterSlideProgressDTO> chapters,
                                                       String batchName,
                                                       String instituteName,
                                                       String moduleName) {
        StringBuilder body = new StringBuilder();

        // Header section
        body.append("<h1 style='color:#000000;'>Chapter-wise Batch Report</h1>")
            .append("<p><strong>Institute:</strong> ").append(escapeHtml(instituteName)).append("<br/>")
            .append("<strong>Batch:</strong> ").append(escapeHtml(batchName)).append("<br/>")
            .append("<strong>Module:</strong> ").append(escapeHtml(moduleName)).append("</p>");

        // One table per chapter
        for (ChapterSlideProgressDTO chapter : chapters) {
            body.append("<h3 style='margin-top:20px; color:#f57c00;'>Chapter: ")
                .append(escapeHtml(chapter.getChapterName()))
                .append("</h3>");

            body.append("""
                    <table style='width:100%; border-collapse:collapse; margin-bottom:16px; font-size:13px;'>
                      <thead>
                        <tr style='background-color:#fde7cc;'>
                          <th style='border:1px solid #ddd; padding:8px;'>Study Slide</th>
                          <th style='border:1px solid #ddd; padding:8px;'>Source Type</th>
                          <th style='border:1px solid #ddd; padding:8px;'>Avg Time Spent (min)</th>
                          <th style='border:1px solid #ddd; padding:8px;'>Avg Concentration Score</th>
                        </tr>
                      </thead>
                      <tbody>
                    """);

            if (chapter.getSlides() != null && !chapter.getSlides().isEmpty()) {
                for (ChapterSlideProgressDTO.SlideProgressDTO slide : chapter.getSlides()) {
                    body.append("<tr>")
                        .append("<td style='border:1px solid #ddd; padding:8px;'>")
                        .append(escapeHtml(slide.getSlideTitle()))
                        .append("</td>")
                        .append("<td style='border:1px solid #ddd; padding:8px;'>")
                        .append(escapeHtml(slide.getSlideSourceType()))
                        .append("</td>")
                        .append("<td style='border:1px solid #ddd; padding:8px;'>")
                        .append(slide.getAvgTimeSpent() == null ? "0.00" : String.format("%.2f", slide.getAvgTimeSpent()))
                        .append("</td>")
                        .append("<td style='border:1px solid #ddd; padding:8px;'>")
                        .append(slide.getAvgConcentrationScore() == null ? "0.00%" : String.format("%.2f%%", slide.getAvgConcentrationScore()))
                        .append("</td>")
                        .append("</tr>");
                }
            } else {
                body.append("""
                        <tr>
                          <td colspan="4" style='border:1px solid #ddd; padding:8px; text-align:center;'>No slides found</td>
                        </tr>
                        """);
            }

            body.append("</tbody></table>");
        }

        // Wrap in basic HTML template
        return """
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="UTF-8">
                  <title>Chapter-wise Batch Report</title>
                  <style>
                    body {
                      font-family: Arial, sans-serif;
                      margin: 20px;
                      color: #333;
                    }
                    h1, h3 {
                      margin-bottom: 8px;
                    }
                  </style>
                </head>
                <body>
                """ + body + """
                </body>
                </html>
                """;
    }

}


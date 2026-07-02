package vacademy.io.notification_service.features.analytics.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.analytics.dto.DateRangeDTO;
import vacademy.io.notification_service.features.analytics.dto.LeadJourneyFunnelResponseDTO;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Builds the lead-journey daily-message funnel: per-day send/recipient/reply
 * counts plus a per-recipient roster, for a multi-day WhatsApp drip identified by
 * a template-name prefix (default {@code lead_journey_day_}).
 *
 * <p>These journey templates are not registered in notification_template_day_map,
 * so they never show up in the day-map-driven daily-participation report. This
 * service reads the raw notification_log directly, parses the day number from the
 * message body and the center from the message payload, and matches replies by
 * recipient phone.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LeadJourneyFunnelService {

    private static final String DEFAULT_TEMPLATE_PREFIX = "lead_journey_day_";
    /** Upper bound on raw journey rows fetched in one call. */
    private static final int FETCH_LIMIT = 10000;

    private final NotificationLogRepository notificationLogRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public LeadJourneyFunnelResponseDTO getFunnel(
            String instituteId,
            String senderBusinessChannelId,
            String templatePrefix,
            Timestamp startDate,
            Timestamp endDate
    ) {
        String prefix = (templatePrefix == null || templatePrefix.isBlank())
                ? DEFAULT_TEMPLATE_PREFIX : templatePrefix.trim();
        String startStr = startDate != null ? startDate.toString() : "";
        String endStr = endDate != null ? endDate.toString() : "";
        String channel = (senderBusinessChannelId == null || senderBusinessChannelId.isBlank())
                ? "" : senderBusinessChannelId.trim();

        List<NotificationLog> logs = notificationLogRepository.findJourneyOutgoingLogs(
                instituteId, channel, prefix, startStr, endStr, FETCH_LIMIT);

        // Pattern to pull the day number + full template identifier from the body.
        Pattern dayPattern = Pattern.compile(Pattern.quote(prefix) + "(\\d+)(\\w*)");

        // Per-day aggregation (sorted by day number).
        Map<Integer, DayAccumulator> byDay = new TreeMap<>();
        // Per-recipient roster (insertion-ordered for stable output).
        Map<String, RecipientAccumulator> byPhone = new LinkedHashMap<>();
        long totalSends = 0;

        for (NotificationLog logRow : logs) {
            String body = logRow.getBody();
            String phone = logRow.getChannelId();
            if (body == null || phone == null) {
                continue;
            }
            Matcher m = dayPattern.matcher(body);
            if (!m.find()) {
                continue;
            }
            int dayNumber;
            try {
                dayNumber = Integer.parseInt(m.group(1));
            } catch (NumberFormatException ex) {
                continue;
            }
            String templateIdentifier = prefix + m.group(1) + m.group(2);
            String center = extractCenter(logRow.getMessagePayload());

            totalSends++;

            DayAccumulator day = byDay.computeIfAbsent(dayNumber, k -> new DayAccumulator());
            day.templateIdentifier = templateIdentifier;
            day.sends++;
            day.recipients.add(phone);

            RecipientAccumulator rec = byPhone.computeIfAbsent(phone, k -> new RecipientAccumulator());
            rec.days.add(dayNumber);
            rec.messageCount++;
            if (rec.center == null && center != null) {
                rec.center = center;
            }
            String sentAt = logRow.getNotificationDate() != null
                    ? logRow.getNotificationDate().toString() : null;
            if (sentAt != null && (rec.lastSentAt == null || sentAt.compareTo(rec.lastSentAt) > 0)) {
                rec.lastSentAt = sentAt;
            }
        }

        // Resolve which recipients replied (any incoming in the window).
        Set<String> repliedPhones = new HashSet<>();
        if (!byPhone.isEmpty()) {
            repliedPhones.addAll(notificationLogRepository.findRepliedPhones(
                    instituteId, new ArrayList<>(byPhone.keySet()), startStr, endStr));
        }

        // Build per-day metrics.
        List<LeadJourneyFunnelResponseDTO.DayMetric> dayMetrics = new ArrayList<>();
        for (Map.Entry<Integer, DayAccumulator> e : byDay.entrySet()) {
            DayAccumulator acc = e.getValue();
            int uniqueRecipients = acc.recipients.size();
            int replied = 0;
            for (String p : acc.recipients) {
                if (repliedPhones.contains(p)) {
                    replied++;
                }
            }
            dayMetrics.add(LeadJourneyFunnelResponseDTO.DayMetric.builder()
                    .dayNumber(e.getKey())
                    .templateIdentifier(acc.templateIdentifier)
                    .totalSends(acc.sends)
                    .uniqueRecipients(uniqueRecipients)
                    .replied(replied)
                    .replyRate(rate(replied, uniqueRecipients))
                    .build());
        }

        // Build recipient roster.
        List<LeadJourneyFunnelResponseDTO.Recipient> recipients = new ArrayList<>();
        for (Map.Entry<String, RecipientAccumulator> e : byPhone.entrySet()) {
            RecipientAccumulator acc = e.getValue();
            List<Integer> daysReceived = new ArrayList<>(acc.days);
            daysReceived.sort(Comparator.naturalOrder());
            recipients.add(LeadJourneyFunnelResponseDTO.Recipient.builder()
                    .phone(e.getKey())
                    .center(acc.center)
                    .daysReceived(daysReceived)
                    .messageCount(acc.messageCount)
                    .lastSentAt(acc.lastSentAt)
                    .replied(repliedPhones.contains(e.getKey()))
                    .build());
        }
        // Most recently messaged first.
        recipients.sort(Comparator.comparing(
                LeadJourneyFunnelResponseDTO.Recipient::getLastSentAt,
                Comparator.nullsLast(Comparator.reverseOrder())));

        int uniqueRecipients = byPhone.size();
        LeadJourneyFunnelResponseDTO.Summary summary = LeadJourneyFunnelResponseDTO.Summary.builder()
                .totalSends(totalSends)
                .uniqueRecipients(uniqueRecipients)
                .repliedRecipients(repliedPhones.size())
                .replyRate(rate(repliedPhones.size(), uniqueRecipients))
                .build();

        return LeadJourneyFunnelResponseDTO.builder()
                .instituteId(instituteId)
                .templatePrefix(prefix)
                .dateRange(DateRangeDTO.builder().startDate(startStr).endDate(endStr).build())
                .totalDays(dayMetrics.size())
                .summary(summary)
                .days(dayMetrics)
                .recipients(recipients)
                .recipientsTruncated(logs.size() >= FETCH_LIMIT)
                .build();
    }

    private static double rate(int numerator, int denominator) {
        if (denominator <= 0) {
            return 0.0;
        }
        return Math.round((numerator * 10000.0) / denominator) / 100.0;
    }

    /**
     * Pulls the center name out of a WhatsApp send payload. The payload looks like
     * {@code {"bodyParams":{"1":"Wakad","2":"https://..."}}}; the center is the
     * first body-param value that is non-blank and not a URL.
     */
    private String extractCenter(String messagePayload) {
        if (messagePayload == null || messagePayload.isBlank()) {
            return null;
        }
        try {
            JsonNode root = objectMapper.readTree(messagePayload);
            JsonNode bodyParams = root.get("bodyParams");
            if (bodyParams == null || !bodyParams.isObject()) {
                return null;
            }
            for (JsonNode value : bodyParams) {
                if (value == null || !value.isTextual()) {
                    continue;
                }
                String text = value.asText().trim();
                if (text.isEmpty() || text.startsWith("http")) {
                    continue;
                }
                return text;
            }
        } catch (Exception ex) {
            log.debug("Could not parse center from journey payload: {}", ex.getMessage());
        }
        return null;
    }

    private static final class DayAccumulator {
        private String templateIdentifier;
        private long sends;
        private final Set<String> recipients = new HashSet<>();
    }

    private static final class RecipientAccumulator {
        private String center;
        private int messageCount;
        private String lastSentAt;
        private final Set<Integer> days = new HashSet<>();
    }
}

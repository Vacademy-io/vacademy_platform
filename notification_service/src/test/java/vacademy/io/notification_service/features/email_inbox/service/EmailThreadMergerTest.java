package vacademy.io.notification_service.features.email_inbox.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vacademy.io.notification_service.features.email_inbox.service.EmailThreadMerger.MergedRow;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class EmailThreadMergerTest {

    private static final String TO = "shreyash@vidyayatan.com";
    private static final String FROM = "hello@vidyayatan.com";
    private static final String TITLE = "Welcome to the batch";
    private static final Instant T0 = Instant.parse("2026-09-14T07:34:00Z");

    static NotificationLog row(String id, String type, String source, String body, Instant at, String from) {
        NotificationLog nl = new NotificationLog();
        nl.setId(id);
        nl.setNotificationType(type);
        nl.setChannelId(TO);
        nl.setSource(source);
        nl.setBody(body);
        nl.setNotificationDate(at);
        nl.setSenderBusinessChannelId(from);
        return nl;
    }

    static NotificationLog announcement(String id, Instant at) {
        return row(id, "EMAIL", "announcement-service", TITLE, at, FROM);
    }

    static NotificationLog unified(String id, Instant at) {
        return row(id, "EMAIL", "unified-send", "<html><body>Hi</body></html>", at, FROM);
    }

    @Test
    @DisplayName("twin pair collapses to the HTML row carrying the campaign title as subject")
    void twinMerged() {
        // Repo order: newest first (the SMTP row lands ~1-2s after the announcement row).
        List<MergedRow> out = EmailThreadMerger.merge(List.of(
                unified("u1", T0.plusSeconds(2)),
                announcement("a1", T0)));

        assertThat(out).hasSize(1);
        assertThat(out.get(0).row().getId()).isEqualTo("u1");
        assertThat(out.get(0).derivedSubject()).isEqualTo(TITLE);
        assertThat(out.get(0).campaign()).isTrue();
    }

    @Test
    void noTwinKeepsAnnouncementRowAsCampaign() {
        List<MergedRow> out = EmailThreadMerger.merge(List.of(announcement("a1", T0)));

        assertThat(out).hasSize(1);
        assertThat(out.get(0).row().getId()).isEqualTo("a1");
        assertThat(out.get(0).derivedSubject()).isNull();
        assertThat(out.get(0).campaign()).isTrue();
    }

    @Test
    void differentInstituteSenderIsNotMerged() {
        NotificationLog other = unified("u1", T0.plusSeconds(1));
        other.setSenderBusinessChannelId("support@vidyayatan.com");
        List<MergedRow> out = EmailThreadMerger.merge(List.of(other, announcement("a1", T0)));

        assertThat(out).hasSize(2);
        assertThat(out.get(1).campaign()).isTrue();
        assertThat(out.get(0).campaign()).isFalse();
    }

    @Test
    void nullSenderOnBothSidesStillMerges() {
        NotificationLog a = announcement("a1", T0);
        a.setSenderBusinessChannelId(null);
        NotificationLog u = unified("u1", T0.plusSeconds(1));
        u.setSenderBusinessChannelId(null);

        assertThat(EmailThreadMerger.merge(List.of(u, a))).hasSize(1);
    }

    @Test
    void elevenSecondsApartIsNotMerged() {
        List<MergedRow> out = EmailThreadMerger.merge(List.of(
                unified("u1", T0.plusSeconds(11)),
                announcement("a1", T0)));

        assertThat(out).hasSize(2);
    }

    @Test
    void tenSecondsApartStillMerges() {
        List<MergedRow> out = EmailThreadMerger.merge(List.of(
                unified("u1", T0.plusSeconds(10)),
                announcement("a1", T0)));

        assertThat(out).hasSize(1);
    }

    @Test
    void unifiedRowWithPayloadSubjectKeepsIt() {
        NotificationLog u = unified("u1", T0.plusSeconds(1));
        u.setMessagePayload("{\"subject\":\"Real subject line\"}");
        List<MergedRow> out = EmailThreadMerger.merge(List.of(u, announcement("a1", T0)));

        assertThat(out).hasSize(1);
        assertThat(out.get(0).row().getId()).isEqualTo("u1");
        // Merger leaves derivedSubject empty; the payload subject wins in toMessage.
        assertThat(out.get(0).derivedSubject()).isNull();
        assertThat(out.get(0).campaign()).isTrue();
    }

    @Test
    void orderIsPreserved() {
        NotificationLog inbound = row("i1", "INBOUND_EMAIL", "u2", "Re: hello", T0.plusSeconds(600), FROM);
        List<MergedRow> out = EmailThreadMerger.merge(List.of(
                inbound,
                unified("u2", T0.plusSeconds(300)),
                announcement("a2", T0.plusSeconds(299)),
                unified("u1", T0.plusSeconds(2)),
                announcement("a1", T0)));

        assertThat(out).extracting(m -> m.row().getId()).containsExactly("i1", "u2", "u1");
    }

    @Test
    void inboundRowsAreUntouched() {
        NotificationLog inbound = row("i1", "INBOUND_EMAIL", "F9E8AD65-A66F-4A53-A97B-E855B48ABD26",
                "Re: hello neeraj", T0.plusSeconds(1), FROM);
        List<MergedRow> out = EmailThreadMerger.merge(List.of(inbound, announcement("a1", T0)));

        assertThat(out).hasSize(2);
        assertThat(out.get(0).row()).isSameAs(inbound);
        assertThat(out.get(0).campaign()).isFalse();
        assertThat(out.get(0).derivedSubject()).isNull();
    }

    @Test
    void eachHtmlRowAbsorbsAtMostOneAnnouncement() {
        // Two campaigns fired within seconds: each announcement must pair with its own send.
        List<MergedRow> out = EmailThreadMerger.merge(List.of(
                unified("u2", T0.plusSeconds(6)),
                announcement("a2", T0.plusSeconds(5)),
                unified("u1", T0.plusSeconds(1)),
                announcement("a1", T0)));

        assertThat(out).extracting(m -> m.row().getId()).containsExactly("u2", "u1");
        assertThat(out).allMatch(MergedRow::campaign);
    }

    @Test
    void emptyAndNullInputs() {
        assertThat(EmailThreadMerger.merge(null)).isEmpty();
        assertThat(EmailThreadMerger.merge(List.of())).isEmpty();
    }
}

package vacademy.io.admin_core_service.features.audience.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.dto.LeadSlaConfigDTO;
import vacademy.io.admin_core_service.features.audience.dto.LeadSlaSettingsDTO;
import vacademy.io.admin_core_service.features.audience.entity.LeadSlaConfig;
import vacademy.io.admin_core_service.features.audience.entity.LeadSlaNotifyRole;
import vacademy.io.admin_core_service.features.audience.entity.LeadSlaReminderWindow;
import vacademy.io.admin_core_service.features.audience.repository.LeadSlaConfigRepository;
import vacademy.io.admin_core_service.features.audience.repository.LeadSlaNotifyRoleRepository;
import vacademy.io.admin_core_service.features.audience.repository.LeadSlaReminderWindowRepository;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Reads/writes the table-backed TAT + Follow-up SLA config (replaces the LEAD_SETTING JSON).
 * Exposes a flat shape for the settings UI and the nested {@link LeadSlaConfigDTO} the scheduler
 * already consumes — so the scheduler logic is unchanged, only its source.
 */
@Service
@RequiredArgsConstructor
public class LeadSlaConfigService {

    private static final String TAT = "TAT";
    private static final String FOLLOWUP = "FOLLOWUP";
    private static final int DEFAULT_MINUTES = 24 * 60;

    private final LeadSlaConfigRepository configRepository;
    private final LeadSlaReminderWindowRepository windowRepository;
    private final LeadSlaNotifyRoleRepository notifyRoleRepository;

    // ── Settings UI (flat) ───────────────────────────────────────────────────

    public LeadSlaSettingsDTO getSettings(String instituteId) {
        LeadSlaConfig c = configRepository.findByInstituteId(instituteId).orElse(null);
        List<Integer> tatBefore = windowRepository
                .findByInstituteIdAndSlaTypeOrderByDisplayOrderAsc(instituteId, TAT).stream()
                .map(LeadSlaReminderWindow::getBeforeMinutes).collect(Collectors.toList());
        if (tatBefore.isEmpty()) tatBefore = List.of(30);

        int tatMinutes = c != null ? tatMinutesOf(c) : DEFAULT_MINUTES;
        int followupMinutes = c != null ? followupMinutesOf(c) : DEFAULT_MINUTES;
        return LeadSlaSettingsDTO.builder()
                .tatEnabled(c != null && Boolean.TRUE.equals(c.getTatEnabled()))
                .tatMinutes(tatMinutes)
                .tatHours(ceilHours(tatMinutes))
                .tatBeforeMinutes(tatBefore)
                .tatNotifyRoles(roleNames(instituteId, TAT))
                .followupEnabled(c != null && Boolean.TRUE.equals(c.getFollowupEnabled()))
                .followupSlaMinutes(followupMinutes)
                .followupSlaHours(ceilHours(followupMinutes))
                .followupRemindBeforeMinutes(c != null ? c.getFollowupRemindBeforeMinutes() : 30)
                .followupNotifyRoles(roleNames(instituteId, FOLLOWUP))
                .build();
    }

    @Transactional
    public void save(String instituteId, LeadSlaSettingsDTO dto) {
        LeadSlaConfig c = configRepository.findByInstituteId(instituteId)
                .orElseGet(() -> LeadSlaConfig.builder().instituteId(instituteId).build());
        int tatMinutes = resolveMinutes(dto.getTatMinutes(), dto.getTatHours());
        int followupMinutes = resolveMinutes(dto.getFollowupSlaMinutes(), dto.getFollowupSlaHours());
        c.setTatEnabled(dto.isTatEnabled());
        c.setTatMinutes(tatMinutes);
        c.setTatHours(ceilHours(tatMinutes));
        c.setFollowupEnabled(dto.isFollowupEnabled());
        c.setFollowupSlaMinutes(followupMinutes);
        c.setFollowupSlaHours(ceilHours(followupMinutes));
        c.setFollowupRemindBeforeMinutes(
                dto.getFollowupRemindBeforeMinutes() != null ? dto.getFollowupRemindBeforeMinutes() : 30);
        c.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
        configRepository.save(c);

        // Replace TAT before-windows
        windowRepository.deleteByInstituteIdAndSlaType(instituteId, TAT);
        if (dto.getTatBeforeMinutes() != null) {
            int order = 1;
            for (Integer m : dto.getTatBeforeMinutes()) {
                if (m == null || m <= 0) continue;
                windowRepository.save(LeadSlaReminderWindow.builder()
                        .instituteId(instituteId).slaType(TAT).beforeMinutes(m).displayOrder(order++).build());
            }
        }

        // Replace notify roles
        notifyRoleRepository.deleteByInstituteId(instituteId);
        saveRoles(instituteId, TAT, dto.getTatNotifyRoles());
        saveRoles(instituteId, FOLLOWUP, dto.getFollowupNotifyRoles());
    }

    // ── Duration helpers ─────────────────────────────────────────────────────

    /**
     * Minutes from the request: explicit minutes win, else legacy whole hours, else 24h.
     * Non-positive values fall back to the default so a deadline can never be "now".
     */
    private static int resolveMinutes(Integer minutes, Integer hours) {
        if (minutes != null && minutes > 0) return minutes;
        if (hours != null && hours > 0) return hours * 60;
        return DEFAULT_MINUTES;
    }

    private static int tatMinutesOf(LeadSlaConfig c) {
        if (c.getTatMinutes() != null && c.getTatMinutes() > 0) return c.getTatMinutes();
        return c.getTatHours() != null && c.getTatHours() > 0 ? c.getTatHours() * 60 : DEFAULT_MINUTES;
    }

    private static int followupMinutesOf(LeadSlaConfig c) {
        if (c.getFollowupSlaMinutes() != null && c.getFollowupSlaMinutes() > 0) return c.getFollowupSlaMinutes();
        return c.getFollowupSlaHours() != null && c.getFollowupSlaHours() > 0
                ? c.getFollowupSlaHours() * 60 : DEFAULT_MINUTES;
    }

    /** Whole hours rounded up — what the legacy *_hours columns/fields carry. */
    private static int ceilHours(int minutes) {
        return Math.max(1, (minutes + 59) / 60);
    }

    /**
     * Human-readable duration for workflow copy and UI text: "45 minutes", "1 hour",
     * "1 hour 30 minutes", "24 hours".
     */
    public static String formatDuration(int minutes) {
        int h = minutes / 60;
        int m = minutes % 60;
        String hPart = h == 1 ? "1 hour" : h + " hours";
        String mPart = m == 1 ? "1 minute" : m + " minutes";
        if (h == 0) return mPart;
        if (m == 0) return hPart;
        return hPart + " " + mPart;
    }

    private void saveRoles(String instituteId, String slaType, List<String> roles) {
        if (roles == null) return;
        for (String r : roles) {
            if (r == null || r.isBlank()) continue;
            notifyRoleRepository.save(LeadSlaNotifyRole.builder()
                    .instituteId(instituteId).slaType(slaType).roleName(r).build());
        }
    }

    private List<String> roleNames(String instituteId, String slaType) {
        return notifyRoleRepository.findByInstituteIdAndSlaType(instituteId, slaType).stream()
                .map(LeadSlaNotifyRole::getRoleName).collect(Collectors.toList());
    }

    // ── Scheduler (nested DTO it already consumes) ────────────────────────────

    /** Returns the scheduler config, or null when no config exists / both SLAs are off. */
    public LeadSlaConfigDTO getSchedulerConfig(String instituteId) {
        LeadSlaConfig c = configRepository.findByInstituteId(instituteId).orElse(null);
        if (c == null) return null;
        boolean tatOn = Boolean.TRUE.equals(c.getTatEnabled());
        boolean fuOn = Boolean.TRUE.equals(c.getFollowupEnabled());
        if (!tatOn && !fuOn) return null;

        LeadSlaConfigDTO dto = new LeadSlaConfigDTO();

        LeadSlaConfigDTO.TatReminder tat = new LeadSlaConfigDTO.TatReminder();
        tat.setEnabled(tatOn);
        tat.setTatMinutes(tatMinutesOf(c));
        tat.setTatHours(ceilHours(tatMinutesOf(c)));
        List<LeadSlaConfigDTO.BeforeTrigger> windows = new ArrayList<>();
        for (LeadSlaReminderWindow w : windowRepository
                .findByInstituteIdAndSlaTypeOrderByDisplayOrderAsc(instituteId, TAT)) {
            LeadSlaConfigDTO.BeforeTrigger b = new LeadSlaConfigDTO.BeforeTrigger();
            b.setBeforeMinutes(w.getBeforeMinutes());
            b.setTriggerKey("LEAD_TAT_REMINDER_BEFORE");
            b.setStage("BEFORE_" + w.getBeforeMinutes() + "M");
            windows.add(b);
        }
        tat.setBeforeTatTriggers(windows);
        LeadSlaConfigDTO.TriggerRef tatOverdue = new LeadSlaConfigDTO.TriggerRef();
        tatOverdue.setTriggerKey("LEAD_TAT_OVERDUE");
        tatOverdue.setStage("OVERDUE");
        tat.setOverdueTrigger(tatOverdue);
        tat.setNotifyRoles(roleNames(instituteId, TAT));
        dto.setTatReminder(tat);

        LeadSlaConfigDTO.FollowUp fu = new LeadSlaConfigDTO.FollowUp();
        fu.setEnabled(fuOn);
        fu.setFollowUpSlaMinutes(followupMinutesOf(c));
        fu.setFollowUpSlaHours(ceilHours(followupMinutesOf(c)));
        LeadSlaConfigDTO.BeforeTrigger before = new LeadSlaConfigDTO.BeforeTrigger();
        before.setBeforeMinutes(c.getFollowupRemindBeforeMinutes());
        before.setTriggerKey("FOLLOW_UP_DUE");
        fu.setBeforeFollowUpTrigger(before);
        LeadSlaConfigDTO.TriggerRef fuOverdue = new LeadSlaConfigDTO.TriggerRef();
        fuOverdue.setTriggerKey("FOLLOW_UP_OVERDUE");
        fu.setOverdueTrigger(fuOverdue);
        fu.setNotifyRoles(roleNames(instituteId, FOLLOWUP));
        dto.setFollowUp(fu);

        return dto;
    }
}

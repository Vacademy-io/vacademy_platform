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

        return LeadSlaSettingsDTO.builder()
                .tatEnabled(c != null && Boolean.TRUE.equals(c.getTatEnabled()))
                .tatHours(c != null ? c.getTatHours() : 24)
                .tatBeforeMinutes(tatBefore)
                .tatNotifyRoles(roleNames(instituteId, TAT))
                .followupEnabled(c != null && Boolean.TRUE.equals(c.getFollowupEnabled()))
                .followupSlaHours(c != null ? c.getFollowupSlaHours() : 24)
                .followupRemindBeforeMinutes(c != null ? c.getFollowupRemindBeforeMinutes() : 30)
                .followupNotifyRoles(roleNames(instituteId, FOLLOWUP))
                .build();
    }

    @Transactional
    public void save(String instituteId, LeadSlaSettingsDTO dto) {
        LeadSlaConfig c = configRepository.findByInstituteId(instituteId)
                .orElseGet(() -> LeadSlaConfig.builder().instituteId(instituteId).build());
        c.setTatEnabled(dto.isTatEnabled());
        c.setTatHours(dto.getTatHours() != null ? dto.getTatHours() : 24);
        c.setFollowupEnabled(dto.isFollowupEnabled());
        c.setFollowupSlaHours(dto.getFollowupSlaHours() != null ? dto.getFollowupSlaHours() : 24);
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
        tat.setTatHours(c.getTatHours());
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
        fu.setFollowUpSlaHours(c.getFollowupSlaHours());
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

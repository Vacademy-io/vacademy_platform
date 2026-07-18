package vacademy.io.admin_core_service.features.parent_portal.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.core.security.GuardedChild;
import vacademy.io.admin_core_service.core.security.GuardianAccessGuard;
import vacademy.io.admin_core_service.features.certificate.service.CertificateReadService;
import vacademy.io.admin_core_service.features.invoice.dto.InvoiceDTO;
import vacademy.io.admin_core_service.features.invoice.service.InvoiceService;
import vacademy.io.admin_core_service.features.learner_badge.service.LearnerBadgeService;
import vacademy.io.admin_core_service.features.parent_portal.dto.ChildOverviewDTO;
import vacademy.io.admin_core_service.features.parent_portal.dto.ChildReportListItemDTO;
import vacademy.io.admin_core_service.features.parent_portal.dto.ParentChildSummaryDTO;
import vacademy.io.admin_core_service.features.parent_portal.dto.ParentPortalSettingsDTO;
import vacademy.io.admin_core_service.features.student_analysis.entity.StudentAnalysisProcess;
import vacademy.io.admin_core_service.features.student_analysis.repository.StudentAnalysisProcessRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * The child-home overview: cheap counts + module availability, each collector
 * fault-isolated. A collector that throws lands its module in
 * {@code unavailableModules} and leaves its count null — never zero. The six
 * tiles fetch their own LIVE detail; this is the at-a-glance header + the
 * "needs your attention" inputs (pending invoices, latest report).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ParentPortalOverviewService {

    private final GuardianAccessGuard guard;
    private final ParentPortalSettingService settingService;
    private final LearnerBadgeService learnerBadgeService;
    private final CertificateReadService certificateReadService;
    private final InvoiceService invoiceService;
    private final StudentAnalysisProcessRepository processRepository;

    public ChildOverviewDTO overview(CustomUserDetails caller, String childUserId) {
        GuardedChild child = guard.requireLinkedChild(caller, childUserId);
        ParentPortalSettingsDTO settings = settingService.requireEnabled(child.instituteId());

        List<String> available = visibleModules(settings);
        List<String> unavailable = new ArrayList<>();

        ChildOverviewDTO.ChildOverviewDTOBuilder b = ChildOverviewDTO.builder()
                .child(ParentChildSummaryDTO.builder()
                        .childUserId(child.childUserId())
                        .fullName(child.fullName())
                        .instituteId(child.instituteId())
                        .build())
                .availableModules(available);

        if (available.contains("badges")) {
            try {
                b.badgeCount(learnerBadgeService.getActiveAwardsForUser(child.childUserId(), child.instituteId()).size());
            } catch (Exception e) {
                markUnavailable("badges", unavailable, e);
            }
        }
        if (available.contains("certificates")) {
            try {
                b.certificateCount(certificateReadService.listForUser(child.childUserId(), child.instituteId()).size());
            } catch (Exception e) {
                markUnavailable("certificates", unavailable, e);
            }
        }
        if (available.contains("payments")) {
            try {
                List<InvoiceDTO> invoices = invoiceService.getInvoicesByUserId(child.childUserId(), child.instituteId());
                b.invoiceCount(invoices.size());
                b.pendingInvoiceCount((int) invoices.stream().filter(this::isPending).count());
            } catch (Exception e) {
                markUnavailable("payments", unavailable, e);
            }
        }
        if (available.contains("reports")) {
            try {
                List<StudentAnalysisProcess> latest = processRepository
                        .findByUserIdAndStatusOrderByCreatedAtDesc(child.childUserId(), "COMPLETED", PageRequest.of(0, 1))
                        .getContent();
                b.reportCount(latest.size());
                if (!latest.isEmpty()) {
                    StudentAnalysisProcess p = latest.get(0);
                    b.latestReport(ChildReportListItemDTO.builder()
                            .processId(p.getId()).name(p.getName())
                            .status(p.getStatus()).createdAt(p.getCreatedAt()).build());
                }
            } catch (Exception e) {
                markUnavailable("reports", unavailable, e);
            }
        }

        b.unavailableModules(unavailable);
        return b.build();
    }

    private boolean isPending(InvoiceDTO inv) {
        String s = inv.getStatus();
        return s != null && !s.equalsIgnoreCase("PAID") && !s.equalsIgnoreCase("CANCELLED")
                && !s.equalsIgnoreCase("VOID");
    }

    private List<String> visibleModules(ParentPortalSettingsDTO settings) {
        List<String> visible = new ArrayList<>();
        Map<String, Boolean> modules = settings.getModules();
        if (modules != null) {
            modules.forEach((k, v) -> {
                if (Boolean.TRUE.equals(v)) visible.add(k);
            });
        }
        return visible;
    }

    private void markUnavailable(String module, List<String> unavailable, Exception e) {
        log.warn("Parent overview module '{}' unavailable: {}", module, e.getMessage());
        unavailable.add(module);
    }
}

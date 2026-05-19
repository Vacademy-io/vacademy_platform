package vacademy.io.admin_core_service.features.suborg.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteSettingDTO;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.suborg.dto.SubOrgFinanceDetailDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentOptionRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Powers the manage-sub-orgs detail panel. Reads only — no mutations.
 *
 * Roster comes from {@code student_session_institute_group_mapping} filtered by sub_org_id.
 * Admin payment is the first ROOT_ADMIN row's UserPlan; CPO ledger is its StudentFeePayment
 * rows. Learner rows include outstanding dues only if the learner happens to have SFPs
 * (which is rare under the FREE-scoped-invite flow but supported for completeness).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubOrgFinanceService {

    private static final String ROLE_ROOT_ADMIN = "ROOT_ADMIN";
    private static final String SFP_STATUS_PAID = "PAID";

    private final StudentSessionInstituteGroupMappingRepository mappingRepository;
    private final UserPlanRepository userPlanRepository;
    private final PaymentOptionRepository paymentOptionRepository;
    private final EnrollInviteRepository enrollInviteRepository;
    private final StudentFeePaymentRepository studentFeePaymentRepository;
    private final InstituteRepository instituteRepository;
    private final AuthService authService;

    @Transactional(readOnly = true)
    public SubOrgFinanceDetailDTO getFinanceDetail(String subOrgId, String parentInstituteId) {
        if (!StringUtils.hasText(subOrgId)) {
            throw new VacademyException("sub_org_id is required");
        }

        Institute subOrg = instituteRepository.findById(subOrgId)
                .orElseThrow(() -> new VacademyException("Sub-organization not found: " + subOrgId));

        List<Object[]> rosterRows = mappingRepository.findActiveSubOrgRoster(subOrgId);

        // Partition rows into root-admin and everyone-else. Sub-orgs normally have a single
        // ROOT_ADMIN; while testing produces multiples, the right one to show is the one
        // that actually has a CPO ledger (non-empty SFP rows). Falls back to "first seen"
        // if none of the admins have bills yet.
        List<Object[]> adminCandidates = new ArrayList<>();
        List<Object[]> learnerRows = new ArrayList<>(rosterRows.size());
        for (Object[] row : rosterRows) {
            String roles = (String) row[4];
            if (roles != null && roles.toUpperCase().contains(ROLE_ROOT_ADMIN)) {
                adminCandidates.add(row);
            } else {
                learnerRows.add(row);
            }
        }
        Object[] rootAdminRow = pickAdminRowWithBills(adminCandidates);

        // Resolve user details in one auth-service round-trip.
        Map<String, UserDTO> userMap = fetchUsers(rosterRows);

        SubOrgFinanceDetailDTO.AdminPayment adminPayment = rootAdminRow != null
                ? buildAdminPayment(rootAdminRow, userMap)
                : null;

        List<SubOrgFinanceDetailDTO.LearnerRow> learners = new ArrayList<>(learnerRows.size());
        BigDecimal learnerOutstanding = BigDecimal.ZERO;
        for (Object[] row : learnerRows) {
            SubOrgFinanceDetailDTO.LearnerRow learnerRow = buildLearnerRow(row, userMap);
            learners.add(learnerRow);
            if (learnerRow.getOutstandingAmount() != null) {
                learnerOutstanding = learnerOutstanding.add(learnerRow.getOutstandingAmount());
            }
        }

        BigDecimal totalOutstanding = learnerOutstanding;
        if (adminPayment != null && adminPayment.getOutstandingAmount() != null) {
            totalOutstanding = totalOutstanding.add(adminPayment.getOutstandingAmount());
        }

        SubOrgFinanceDetailDTO.SeatUsage seatUsage = buildSeatUsage(
                rootAdminRow, learnerRows, subOrgId, parentInstituteId);

        return SubOrgFinanceDetailDTO.builder()
                .subOrgId(subOrgId)
                .subOrgName(subOrg.getInstituteName())
                .adminPayment(adminPayment)
                .learners(learners)
                .totals(SubOrgFinanceDetailDTO.Totals.builder()
                        .learnerCount(learners.size())
                        .totalOutstanding(totalOutstanding)
                        .build())
                .seatUsage(seatUsage)
                .build();
    }

    /**
     * Prefer the admin whose UserPlan has any non-empty StudentFeePayment rows. If none
     * do (e.g. a stale enrollment that pre-dates the CPO fix), fall back to the first
     * admin encountered. Returns null when the candidate list is empty.
     */
    private Object[] pickAdminRowWithBills(List<Object[]> candidates) {
        if (candidates == null || candidates.isEmpty()) return null;
        for (Object[] row : candidates) {
            String userPlanId = (String) row[3];
            if (!StringUtils.hasText(userPlanId)) continue;
            if (!studentFeePaymentRepository.findByUserPlanId(userPlanId).isEmpty()) {
                return row;
            }
        }
        return candidates.get(0);
    }

    /**
     * Seat cap summary. {@code used} is the active learner mapping count (admins excluded
     * by the partition above). {@code total} resolution order:
     *   1. The chosen admin's PaymentPlan.memberCount  — non-CPO sub-orgs.
     *   2. The org-level invite's settingJson.SUB_ORG_SETTING.MEMBER_COUNT — CPO sub-orgs,
     *      because the shared synthetic CPO PaymentPlan can't carry per-sub-org caps.
     * Returns null total when no cap is configured anywhere.
     */
    private SubOrgFinanceDetailDTO.SeatUsage buildSeatUsage(Object[] adminRow,
                                                            List<Object[]> learnerRows,
                                                            String subOrgId,
                                                            String parentInstituteId) {
        int used = learnerRows != null ? learnerRows.size() : 0;
        Integer total = null;
        if (adminRow != null) {
            String adminUserPlanId = (String) adminRow[3];
            if (StringUtils.hasText(adminUserPlanId)) {
                Optional<UserPlan> upOpt = userPlanRepository.findById(adminUserPlanId);
                if (upOpt.isPresent()) {
                    PaymentPlan plan = upOpt.get().getPaymentPlan();
                    if (plan != null && plan.getMemberCount() != null) {
                        total = plan.getMemberCount();
                    }
                }
            }
        }
        // CPO fallback — read MEMBER_COUNT from the sub-org's org-level invite settingJson.
        if (total == null && StringUtils.hasText(subOrgId) && StringUtils.hasText(parentInstituteId)) {
            total = readMemberCountFromSettingsForSubOrg(subOrgId, parentInstituteId);
        }
        Integer remaining = (total != null) ? Math.max(0, total - used) : null;
        return SubOrgFinanceDetailDTO.SeatUsage.builder()
                .used(used)
                .total(total)
                .remaining(remaining)
                .build();
    }

    private Integer readMemberCountFromSettingsForSubOrg(String subOrgId, String parentInstituteId) {
        try {
            // The org-level SUB_ORG-tagged invite is where MEMBER_COUNT is persisted for
            // CPO sub-orgs (see SubOrgSubscriptionService.createSubOrgWithSubscription).
            List<EnrollInvite> candidates = enrollInviteRepository
                    .findBySubOrgIdAndInstituteId(subOrgId, parentInstituteId,
                            List.of("ACTIVE", "INACTIVE", "DELETED"));
            ObjectMapper mapper = new ObjectMapper();
            for (EnrollInvite invite : candidates) {
                if (!StringUtils.hasText(invite.getSettingJson())) continue;
                try {
                    EnrollInviteSettingDTO dto = mapper.readValue(
                            invite.getSettingJson(), EnrollInviteSettingDTO.class);
                    Integer mc = Optional.ofNullable(dto)
                            .map(EnrollInviteSettingDTO::getSetting)
                            .map(EnrollInviteSettingDTO.Settings::getSubOrgSetting)
                            .map(EnrollInviteSettingDTO.SubOrgSetting::getMemberCount)
                            .orElse(null);
                    if (mc != null) return mc;
                } catch (Exception ignored) {
                    /* try next invite */
                }
            }
        } catch (Exception e) {
            log.debug("Failed to read MEMBER_COUNT from settingJson for sub-org {}: {}",
                    subOrgId, e.getMessage());
        }
        return null;
    }

    private Map<String, UserDTO> fetchUsers(List<Object[]> rows) {
        List<String> userIds = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            String userId = (String) row[1];
            if (userId != null) userIds.add(userId);
        }
        if (userIds.isEmpty()) return Map.of();
        try {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(userIds);
            Map<String, UserDTO> result = new HashMap<>(users.size());
            for (UserDTO u : users) {
                if (u != null && u.getId() != null) result.put(u.getId(), u);
            }
            return result;
        } catch (Exception e) {
            log.warn("Failed to resolve user names for sub-org finance detail: {}", e.getMessage());
            return Map.of();
        }
    }

    private SubOrgFinanceDetailDTO.AdminPayment buildAdminPayment(Object[] row, Map<String, UserDTO> userMap) {
        String userId = (String) row[1];
        String userPlanId = (String) row[3];
        UserDTO user = userMap.get(userId);
        String fullName = user != null ? user.getFullName() : (String) row[6];

        SubOrgFinanceDetailDTO.AdminPayment.AdminPaymentBuilder builder =
                SubOrgFinanceDetailDTO.AdminPayment.builder()
                        .userId(userId)
                        .fullName(fullName)
                        .userPlanId(userPlanId);

        if (!StringUtils.hasText(userPlanId)) return builder.build();

        Optional<UserPlan> userPlanOpt = userPlanRepository.findById(userPlanId);
        if (userPlanOpt.isEmpty()) return builder.build();

        UserPlan userPlan = userPlanOpt.get();
        builder.userPlanStatus(userPlan.getStatus())
                .startDate(userPlan.getStartDate())
                .endDate(userPlan.getEndDate());

        // Resolve PaymentOption to expose payment_type + cpo id. UserPlan.paymentOption is LAZY,
        // and the json snapshot may be stale post-CPO-sync, so re-read from the repo.
        PaymentOption paymentOption = null;
        if (StringUtils.hasText(userPlan.getPaymentOptionId())) {
            paymentOption = paymentOptionRepository.findById(userPlan.getPaymentOptionId()).orElse(null);
        }
        if (paymentOption != null) {
            builder.paymentType(paymentOption.getType())
                    .complexPaymentOptionId(paymentOption.getComplexPaymentOptionId());
        }

        // CPO ledger
        List<StudentFeePayment> sfps = studentFeePaymentRepository.findByUserPlanId(userPlanId);
        if (!sfps.isEmpty()) {
            attachLedger(builder, sfps);
        }

        return builder.build();
    }

    private SubOrgFinanceDetailDTO.LearnerRow buildLearnerRow(Object[] row, Map<String, UserDTO> userMap) {
        String userId = (String) row[1];
        String packageSessionId = (String) row[2];
        String userPlanId = (String) row[3];
        Date enrolledDate = row[5] instanceof Date d ? d : null;
        UserDTO user = userMap.get(userId);
        String fullName = user != null ? user.getFullName() : (String) row[6];

        SubOrgFinanceDetailDTO.LearnerRow.LearnerRowBuilder builder =
                SubOrgFinanceDetailDTO.LearnerRow.builder()
                        .userId(userId)
                        .fullName(fullName)
                        .packageSessionId(packageSessionId)
                        .userPlanId(userPlanId)
                        .enrolledDate(enrolledDate)
                        .outstandingAmount(BigDecimal.ZERO)
                        .pendingInstallmentsCount(0);

        if (StringUtils.hasText(userPlanId)) {
            List<StudentFeePayment> sfps = studentFeePaymentRepository.findByUserPlanId(userPlanId);
            if (!sfps.isEmpty()) {
                BigDecimal outstanding = sumOutstanding(sfps);
                int pending = countPending(sfps);
                builder.outstandingAmount(outstanding).pendingInstallmentsCount(pending);
                SubOrgFinanceDetailDTO.Installment next = nextDue(sfps);
                if (next != null) builder.nextDue(next);
            }
        }
        return builder.build();
    }

    private void attachLedger(SubOrgFinanceDetailDTO.AdminPayment.AdminPaymentBuilder builder,
                              List<StudentFeePayment> sfps) {
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal paid = BigDecimal.ZERO;
        BigDecimal outstanding = BigDecimal.ZERO;
        int pending = 0;
        List<SubOrgFinanceDetailDTO.Installment> ledger = new ArrayList<>(sfps.size());

        // Stable order by due date (nulls last) keeps the UI ledger consistent across reads.
        List<StudentFeePayment> ordered = new ArrayList<>(sfps);
        ordered.sort(Comparator.comparing(StudentFeePayment::getDueDate,
                Comparator.nullsLast(Comparator.naturalOrder())));

        for (StudentFeePayment sfp : ordered) {
            BigDecimal expected = nullToZero(sfp.getAmountExpected());
            BigDecimal amountPaid = nullToZero(sfp.getAmountPaid());
            BigDecimal original = sfp.getOriginalAmount() != null ? sfp.getOriginalAmount() : expected;
            total = total.add(original);
            paid = paid.add(amountPaid);
            if (!SFP_STATUS_PAID.equalsIgnoreCase(sfp.getStatus())) {
                outstanding = outstanding.add(expected.subtract(amountPaid).max(BigDecimal.ZERO));
                pending++;
            }
            ledger.add(SubOrgFinanceDetailDTO.Installment.builder()
                    .studentFeePaymentId(sfp.getId())
                    .amountExpected(expected)
                    .amountPaid(amountPaid)
                    .dueDate(sfp.getDueDate())
                    .status(sfp.getStatus())
                    .build());
        }

        builder.totalAmount(total)
                .paidAmount(paid)
                .outstandingAmount(outstanding)
                .installmentCount(ledger.size())
                .pendingInstallmentsCount(pending)
                .installments(ledger)
                .nextDue(firstUnpaid(ledger));
    }

    private static SubOrgFinanceDetailDTO.Installment firstUnpaid(List<SubOrgFinanceDetailDTO.Installment> ledger) {
        for (SubOrgFinanceDetailDTO.Installment i : ledger) {
            if (!SFP_STATUS_PAID.equalsIgnoreCase(i.getStatus())) return i;
        }
        return null;
    }

    private static BigDecimal sumOutstanding(List<StudentFeePayment> sfps) {
        BigDecimal sum = BigDecimal.ZERO;
        for (StudentFeePayment sfp : sfps) {
            if (SFP_STATUS_PAID.equalsIgnoreCase(sfp.getStatus())) continue;
            BigDecimal expected = nullToZero(sfp.getAmountExpected());
            BigDecimal paid = nullToZero(sfp.getAmountPaid());
            sum = sum.add(expected.subtract(paid).max(BigDecimal.ZERO));
        }
        return sum;
    }

    private static int countPending(List<StudentFeePayment> sfps) {
        int n = 0;
        for (StudentFeePayment sfp : sfps) {
            if (!SFP_STATUS_PAID.equalsIgnoreCase(sfp.getStatus())) n++;
        }
        return n;
    }

    private static SubOrgFinanceDetailDTO.Installment nextDue(List<StudentFeePayment> sfps) {
        StudentFeePayment best = null;
        for (StudentFeePayment sfp : sfps) {
            if (SFP_STATUS_PAID.equalsIgnoreCase(sfp.getStatus())) continue;
            if (sfp.getDueDate() == null) continue;
            if (best == null || sfp.getDueDate().before(best.getDueDate())) best = sfp;
        }
        if (best == null) return null;
        return SubOrgFinanceDetailDTO.Installment.builder()
                .studentFeePaymentId(best.getId())
                .amountExpected(nullToZero(best.getAmountExpected()))
                .amountPaid(nullToZero(best.getAmountPaid()))
                .dueDate(best.getDueDate())
                .status(best.getStatus())
                .build();
    }

    private static BigDecimal nullToZero(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }
}

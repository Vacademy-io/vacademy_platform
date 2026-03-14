package vacademy.io.admin_core_service.features.fee_management.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.fee_management.dto.InvoiceReceiptDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeeAllocationLedgerDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeePaymentDTO;
import vacademy.io.admin_core_service.features.fee_management.entity.AssignedFeeValue;
import vacademy.io.admin_core_service.features.fee_management.entity.ComplexPaymentOption;
import vacademy.io.admin_core_service.features.fee_management.entity.FeeType;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeeAllocationLedger;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.AssignedFeeValueRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.ComplexPaymentOptionRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.FeeTypeRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeeAllocationLedgerRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.admin_core_service.features.invoice.entity.Invoice;
import vacademy.io.admin_core_service.features.invoice.entity.InvoiceLineItem;
import vacademy.io.admin_core_service.features.invoice.repository.InvoiceLineItemRepository;
import vacademy.io.admin_core_service.features.invoice.repository.InvoiceRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class FeeTrackingService {

    @Autowired
    private StudentFeePaymentRepository studentFeePaymentRepository;

    @Autowired
    private StudentFeeAllocationLedgerRepository studentFeeAllocationLedgerRepository;

    @Autowired
    private AssignedFeeValueRepository assignedFeeValueRepository;

    @Autowired
    private FeeTypeRepository feeTypeRepository;

    @Autowired
    private ComplexPaymentOptionRepository complexPaymentOptionRepository;

    @Autowired
    private UserPlanRepository userPlanRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private InvoiceLineItemRepository invoiceLineItemRepository;

    @Transactional(readOnly = true)
    public List<StudentFeePaymentDTO> getStudentDues(String userId, String instituteId) {
        List<StudentFeePayment> allBills = fetchBillsForUserAndInstitute(userId, instituteId);

        if (allBills == null || allBills.isEmpty()) {
            return Collections.emptyList();
        }

        Map<String, FeeMeta> billIdToMeta = buildFeeMetaMap(allBills);

        return allBills.stream()
                .filter(bill -> !"PAID".equals(bill.getStatus()))
                .map(bill -> mapToPaymentDTO(bill, billIdToMeta.get(bill.getId())))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<StudentFeeAllocationLedgerDTO> getStudentReceipts(String userId, String instituteId) {
        List<StudentFeePayment> bills = fetchBillsForUserAndInstitute(userId, instituteId);
        if (bills == null || bills.isEmpty()) {
            return Collections.emptyList();
        }

        List<String> billIds = bills.stream().map(StudentFeePayment::getId).collect(Collectors.toList());
        Map<String, FeeMeta> billIdToMeta = buildFeeMetaMap(bills);

        return studentFeeAllocationLedgerRepository.findByStudentFeePaymentIdInOrderByCreatedAtDesc(billIds).stream()
                .map(ledger -> mapToLedgerDTO(ledger, billIdToMeta.get(ledger.getStudentFeePaymentId())))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<InvoiceReceiptDTO> getStudentInvoiceReceipts(String userId, String instituteId) {
        List<Invoice> invoices;
        if (instituteId != null && !instituteId.isBlank()) {
            invoices = invoiceRepository.findByUserIdAndInstituteIdOrderByCreatedAtDesc(userId, instituteId);
        } else {
            invoices = invoiceRepository.findByUserIdOrderByCreatedAtDesc(userId);
        }

        if (invoices == null || invoices.isEmpty()) {
            return Collections.emptyList();
        }

        // Collect all source_ids (student_fee_payment_ids) across all line items
        // to batch-load fee metadata
        Set<String> allSourceIds = new HashSet<>();
        Map<String, List<InvoiceLineItem>> invoiceIdToLines = new HashMap<>();
        for (Invoice inv : invoices) {
            List<InvoiceLineItem> lines = invoiceLineItemRepository.findByInvoiceId(inv.getId());
            invoiceIdToLines.put(inv.getId(), lines);
            for (InvoiceLineItem line : lines) {
                if (line.getSourceId() != null && !line.getSourceId().isBlank()) {
                    allSourceIds.add(line.getSourceId());
                }
            }
        }

        // Build fee metadata map keyed by student_fee_payment_id
        Map<String, FeeMeta> billIdToMeta = Collections.emptyMap();
        if (!allSourceIds.isEmpty()) {
            List<StudentFeePayment> relatedBills = studentFeePaymentRepository.findAllById(allSourceIds);
            billIdToMeta = buildFeeMetaMap(relatedBills);
        }

        List<InvoiceReceiptDTO> result = new ArrayList<>();
        for (Invoice inv : invoices) {
            List<InvoiceLineItem> lines = invoiceIdToLines.getOrDefault(inv.getId(), Collections.emptyList());

            // Extract fields from invoice_data_json
            InvoiceDataFields dataFields = extractInvoiceDataFields(inv.getInvoiceDataJson());

            List<InvoiceReceiptDTO.InvoiceLineItemDTO> lineDTOs = new ArrayList<>();
            for (InvoiceLineItem line : lines) {
                FeeMeta meta = (line.getSourceId() != null) ? billIdToMeta.get(line.getSourceId()) : null;
                lineDTOs.add(InvoiceReceiptDTO.InvoiceLineItemDTO.builder()
                        .lineItemId(line.getId())
                        .itemType(line.getItemType())
                        .description(line.getDescription())
                        .amount(line.getAmount())
                        .sourceId(line.getSourceId())
                        .feeTypeName(meta != null ? meta.feeTypeName : null)
                        .feeTypeCode(meta != null ? meta.feeTypeCode : null)
                        .cpoName(meta != null ? meta.cpoName : null)
                        .build());
            }

            result.add(InvoiceReceiptDTO.builder()
                    .invoiceId(inv.getId())
                    .invoiceNumber(inv.getInvoiceNumber())
                    .totalAmount(inv.getTotalAmount())
                    .currency(inv.getCurrency())
                    .status(inv.getStatus())
                    .pdfFileId(inv.getPdfFileId())
                    .type(dataFields.type)
                    .amountPaidNow(dataFields.amountPaidNow)
                    .totalPaid(dataFields.totalPaid)
                    .balanceDue(dataFields.balanceDue)
                    .totalDiscount(dataFields.totalDiscount)
                    .totalExpected(dataFields.totalExpected)
                    .invoiceDate(inv.getInvoiceDate())
                    .createdAt(inv.getCreatedAt())
                    .lineItems(lineDTOs)
                    .build());
        }

        return result;
    }

    private record InvoiceDataFields(
            String type,
            BigDecimal amountPaidNow,
            BigDecimal totalPaid,
            BigDecimal balanceDue,
            BigDecimal totalDiscount,
            BigDecimal totalExpected
    ) {}

    private InvoiceDataFields extractInvoiceDataFields(String json) {
        if (json == null || json.isBlank()) {
            return new InvoiceDataFields(null, null, null, null, null, null);
        }

        return new InvoiceDataFields(
                extractStringField(json, "type"),
                extractDecimalField(json, "amountPaidNow"),
                extractDecimalField(json, "totalPaid"),
                extractDecimalField(json, "balanceDue"),
                extractDecimalField(json, "totalDiscount"),
                extractDecimalField(json, "totalExpected")
        );
    }

    private String extractStringField(String json, String fieldName) {
        String pattern = "\"" + fieldName + "\":\"";
        int idx = json.indexOf(pattern);
        if (idx < 0) return null;
        int start = idx + pattern.length();
        int end = json.indexOf("\"", start);
        return end > start ? json.substring(start, end) : null;
    }

    private BigDecimal extractDecimalField(String json, String fieldName) {
        String pattern = "\"" + fieldName + "\":";
        int idx = json.indexOf(pattern);
        if (idx < 0) return null;
        int start = idx + pattern.length();
        int end = start;
        while (end < json.length()) {
            char c = json.charAt(end);
            if (c == ',' || c == '}') break;
            end++;
        }
        try {
            return new BigDecimal(json.substring(start, end).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private List<StudentFeePayment> fetchBillsForUserAndInstitute(String userId, String instituteId) {
        if (instituteId == null || instituteId.isBlank()) {
            return studentFeePaymentRepository.findByUserId(userId);
        }

        List<UserPlan> plans = userPlanRepository.findByUserIdAndInstituteIdWithFilters(
                userId,
                instituteId,
                List.of("ACTIVE", "PENDING", "PENDING_FOR_PAYMENT", "EXPIRED", "TERMINATED"),
                null
        ).getContent();

        if (plans == null || plans.isEmpty()) {
            return Collections.emptyList();
        }

        List<String> planIds = plans.stream().map(UserPlan::getId).collect(Collectors.toList());
        return studentFeePaymentRepository.findByUserPlanIdIn(planIds);
    }

    private StudentFeePaymentDTO mapToPaymentDTO(StudentFeePayment entity, FeeMeta meta) {
        BigDecimal expected = entity.getAmountExpected() != null ? entity.getAmountExpected() : BigDecimal.ZERO;
        BigDecimal discount = entity.getDiscountAmount() != null ? entity.getDiscountAmount() : BigDecimal.ZERO;
        BigDecimal paid = entity.getAmountPaid() != null ? entity.getAmountPaid() : BigDecimal.ZERO;
        BigDecimal amountDue = expected.subtract(discount).subtract(paid);

        Boolean isOverdue = false;
        Long daysOverdue = null;
        if (entity.getDueDate() != null && amountDue.compareTo(BigDecimal.ZERO) > 0) {
            LocalDate due = entity.getDueDate().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
            LocalDate today = LocalDate.now(ZoneId.systemDefault());
            if (due.isBefore(today)) {
                isOverdue = true;
                daysOverdue = ChronoUnit.DAYS.between(due, today);
            }
        }

        return StudentFeePaymentDTO.builder()
                .id(entity.getId())
                .userPlanId(entity.getUserPlanId())
                .cpoId(entity.getCpoId())
                .cpoName(meta != null ? meta.cpoName : null)
                .feeTypeName(meta != null ? meta.feeTypeName : null)
                .feeTypeCode(meta != null ? meta.feeTypeCode : null)
                .feeTypeDescription(meta != null ? meta.feeTypeDescription : null)
                .amountExpected(entity.getAmountExpected())
                .discountAmount(entity.getDiscountAmount())
                .discountReason(entity.getDiscountReason())
                .amountPaid(entity.getAmountPaid())
                .dueDate(entity.getDueDate())
                .status(entity.getStatus())
                .amountDue(amountDue)
                .isOverdue(isOverdue)
                .daysOverdue(daysOverdue)
                .build();
    }

    private StudentFeeAllocationLedgerDTO mapToLedgerDTO(StudentFeeAllocationLedger entity, FeeMeta meta) {
        return StudentFeeAllocationLedgerDTO.builder()
                .id(entity.getId())
                .paymentLogId(entity.getPaymentLogId())
                .studentFeePaymentId(entity.getStudentFeePaymentId())
                .cpoName(meta != null ? meta.cpoName : null)
                .feeTypeName(meta != null ? meta.feeTypeName : null)
                .feeTypeCode(meta != null ? meta.feeTypeCode : null)
                .feeTypeDescription(meta != null ? meta.feeTypeDescription : null)
                .amountAllocated(entity.getAmountAllocated())
                .allocationType(entity.getAllocationType())
                .remarks(entity.getRemarks())
                .createdAt(entity.getCreatedAt())
                .build();
    }

    private Map<String, FeeMeta> buildFeeMetaMap(List<StudentFeePayment> bills) {
        if (bills == null || bills.isEmpty()) {
            return Collections.emptyMap();
        }

        List<String> cpoIds = bills.stream()
                .map(StudentFeePayment::getCpoId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        List<String> asvIds = bills.stream()
                .map(StudentFeePayment::getAsvId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        Map<String, String> cpoIdToName = complexPaymentOptionRepository.findAllById(cpoIds).stream()
                .collect(Collectors.toMap(ComplexPaymentOption::getId, ComplexPaymentOption::getName, (a, b) -> a));

        Map<String, String> asvIdToFeeTypeId = assignedFeeValueRepository.findAllById(asvIds).stream()
                .collect(Collectors.toMap(AssignedFeeValue::getId, AssignedFeeValue::getFeeTypeId, (a, b) -> a));

        List<String> feeTypeIds = asvIdToFeeTypeId.values().stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        Map<String, FeeType> feeTypeIdToEntity = feeTypeRepository.findAllById(feeTypeIds).stream()
                .collect(Collectors.toMap(FeeType::getId, ft -> ft, (a, b) -> a));

        Map<String, FeeMeta> billIdToMeta = new HashMap<>();
        for (StudentFeePayment bill : bills) {
            String cpoName = bill.getCpoId() != null ? cpoIdToName.get(bill.getCpoId()) : null;

            String feeTypeId = bill.getAsvId() != null ? asvIdToFeeTypeId.get(bill.getAsvId()) : null;
            FeeType feeType = feeTypeId != null ? feeTypeIdToEntity.get(feeTypeId) : null;

            billIdToMeta.put(
                    bill.getId(),
                    new FeeMeta(
                            cpoName,
                            feeType != null ? feeType.getName() : null,
                            feeType != null ? feeType.getCode() : null,
                            feeType != null ? feeType.getDescription() : null
                    )
            );
        }
        return billIdToMeta;
    }

    private record FeeMeta(
            String cpoName,
            String feeTypeName,
            String feeTypeCode,
            String feeTypeDescription
    ) {
    }
}

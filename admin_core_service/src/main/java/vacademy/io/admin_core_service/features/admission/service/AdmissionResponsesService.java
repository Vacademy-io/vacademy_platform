package vacademy.io.admin_core_service.features.admission.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.admission.dto.AdmissionResponseDetailDTO;
import vacademy.io.admin_core_service.features.admission.dto.AdmissionResponsesListItemDTO;
import vacademy.io.admin_core_service.features.admission.dto.AdmissionResponsesListRequestDTO;
import vacademy.io.admin_core_service.features.admission.repository.AdmissionResponsesRepositoryCustom;
import vacademy.io.admin_core_service.features.applicant.entity.Applicant;
import vacademy.io.admin_core_service.features.applicant.repository.ApplicantRepository;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class AdmissionResponsesService {

    @Autowired
    private AdmissionResponsesRepositoryCustom admissionResponsesRepositoryCustom;

    @Autowired
    private AudienceResponseRepository audienceResponseRepository;

    @Autowired
    private InstituteStudentRepository instituteStudentRepository;

    @Autowired
    private ApplicantRepository applicantRepository;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private CustomFieldValuesRepository customFieldValuesRepository;

    @Autowired
    private StudentFeePaymentRepository studentFeePaymentRepository;

    public Page<AdmissionResponsesListItemDTO> list(AdmissionResponsesListRequestDTO filter, int pageNo, int pageSize) {
        if (!StringUtils.hasText(filter.getSessionId())) {
            throw new VacademyException("session_id is mandatory");
        }

        Pageable pageable = PageRequest.of(pageNo, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<AudienceResponse> page = admissionResponsesRepositoryCustom.findAdmissionResponses(filter, pageable);

        List<AudienceResponse> rows = page.getContent();

        Set<String> studentUserIds = rows.stream()
                .map(AudienceResponse::getStudentUserId)
                .filter(StringUtils::hasText)
                .collect(Collectors.toSet());

        Map<String, Student> studentByUserId = studentUserIds.isEmpty()
                ? Collections.emptyMap()
                : instituteStudentRepository.findByUserIdIn(new ArrayList<>(studentUserIds))
                .stream()
                .collect(Collectors.toMap(Student::getUserId, s -> s, (a, b) -> a));

        Set<UUID> applicantIds = rows.stream()
                .map(AudienceResponse::getApplicantId)
                .filter(StringUtils::hasText)
                .map(id -> {
                    try {
                        return UUID.fromString(id);
                    } catch (Exception e) {
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<String, Applicant> applicantById = applicantIds.isEmpty()
                ? Collections.emptyMap()
                : applicantRepository.findAllById(applicantIds)
                .stream()
                .collect(Collectors.toMap(a -> a.getId().toString(), a -> a, (a, b) -> a));

        List<AdmissionResponsesListItemDTO> dtos = rows.stream().map(ar -> {
            Student st = StringUtils.hasText(ar.getStudentUserId()) ? studentByUserId.get(ar.getStudentUserId()) : null;
            Applicant app = StringUtils.hasText(ar.getApplicantId()) ? applicantById.get(ar.getApplicantId()) : null;

            return AdmissionResponsesListItemDTO.builder()
                    .admissionId(ar.getId())
                    .destinationPackageSessionId(ar.getDestinationPackageSessionId())
                    .applyingForClass(st != null ? st.getApplyingForClass() : null)
                    .studentName(st != null ? st.getFullName() : null)
                    .gender(st != null ? st.getGender() : null)
                    .dateOfBirth(st != null ? st.getDateOfBirth() : null)
                    .parentName(ar.getParentName())
                    .parentEmail(ar.getParentEmail())
                    .parentMobile(ar.getParentMobile())
                    .trackingId(app != null ? app.getTrackingId() : null)
                    .status(ar.getOverallStatus())
                    .source(ar.getSourceType())
                    .createdAt(ar.getCreatedAt())
                    .build();
        }).toList();

        return new PageImpl<>(dtos, pageable, page.getTotalElements());
    }

    public AdmissionResponseDetailDTO detail(String admissionId) {
        AudienceResponse ar = audienceResponseRepository.findById(admissionId)
                .orElseThrow(() -> new VacademyException("AudienceResponse not found for admission_id: " + admissionId));

        Student student = null;
        if (StringUtils.hasText(ar.getStudentUserId())) {
            student = instituteStudentRepository.findTopByUserId(ar.getStudentUserId()).orElse(null);
        }

        PackageSession ps = null;
        if (StringUtils.hasText(ar.getDestinationPackageSessionId())) {
            ps = packageSessionRepository.findById(ar.getDestinationPackageSessionId()).orElse(null);
        }

        Applicant applicant = null;
        if (StringUtils.hasText(ar.getApplicantId())) {
            try {
                applicant = applicantRepository.findById(UUID.fromString(ar.getApplicantId())).orElse(null);
            } catch (Exception ignored) {
            }
        }

        Map<String, String> customFields = Collections.emptyMap();
        if (student != null) {
            List<CustomFieldValues> cfvs = customFieldValuesRepository.findBySourceTypeAndSourceId("STUDENT",
                    student.getId());
            customFields = cfvs.stream()
                    .filter(cfv -> StringUtils.hasText(cfv.getCustomFieldId()))
                    .collect(Collectors.toMap(CustomFieldValues::getCustomFieldId, CustomFieldValues::getValue,
                            (a, b) -> a));
        }

        AdmissionResponseDetailDTO.PaymentSummary payment = buildPayment(ar.getStudentUserId());

        return AdmissionResponseDetailDTO.builder()
                .admissionId(ar.getId())
                .overallStatus(ar.getOverallStatus())
                .sourceType(ar.getSourceType())
                .sourceId(ar.getSourceId())
                .destinationPackageSessionId(ar.getDestinationPackageSessionId())
                .enquiryId(ar.getEnquiryId())
                .applicantId(ar.getApplicantId())
                .submittedAt(ar.getSubmittedAt())
                .createdAt(ar.getCreatedAt())
                .parent(AdmissionResponseDetailDTO.Parent.builder()
                        .userId(ar.getUserId())
                        .name(ar.getParentName())
                        .email(ar.getParentEmail())
                        .mobile(ar.getParentMobile())
                        .build())
                .student(student == null ? null : AdmissionResponseDetailDTO.Student.builder()
                        .userId(student.getUserId())
                        .fullName(student.getFullName())
                        .gender(student.getGender())
                        .dateOfBirth(student.getDateOfBirth())
                        .applyingForClass(student.getApplyingForClass())
                        .admissionNo(student.getAdmissionNo())
                        .dateOfAdmission(student.getDateOfAdmission())
                        .admissionType(student.getAdmissionType())
                        .mobileNumber(student.getMobileNumber())
                        .idNumber(student.getIdNumber())
                        .idType(student.getIdType())
                        .previousSchoolName(student.getPreviousSchoolName())
                        .previousSchoolBoard(student.getPreviousSchoolBoard())
                        .lastClassAttended(student.getLastClassAttended())
                        .lastExamResult(student.getLastExamResult())
                        .motherTongue(student.getMotherTongue())
                        .bloodGroup(student.getBloodGroup())
                        .nationality(student.getNationality())
                        .fatherName(student.getFatherName())
                        .motherName(student.getMotherName())
                        .guardianName(student.getGuardianName())
                        .guardianMobile(student.getGuardianMobile())
                        .addressLine(student.getAddressLine())
                        .city(student.getCity())
                        .pinCode(student.getPinCode())
                        .build())
                .packageSession(ps == null ? null : AdmissionResponseDetailDTO.PackageSession.builder()
                        .packageSessionId(ps.getId())
                        .sessionId(ps.getSession() != null ? ps.getSession().getId() : null)
                        .sessionName(ps.getSession() != null ? ps.getSession().getSessionName() : null)
                        .levelName(ps.getLevel() != null ? ps.getLevel().getLevelName() : null)
                        .packageName(ps.getPackageEntity() != null ? ps.getPackageEntity().getPackageName() : null)
                        .status(ps.getStatus())
                        .startTime(ps.getStartTime())
                        .build())
                .application(applicant == null ? null : AdmissionResponseDetailDTO.Application.builder()
                        .applicantId(applicant.getId().toString())
                        .trackingId(applicant.getTrackingId())
                        .workflowType(applicant.getWorkflowType())
                        .applicationStageId(applicant.getApplicationStageId())
                        .applicationStageStatus(applicant.getApplicationStageStatus())
                        .overallStatus(applicant.getOverallStatus())
                        .build())
                .customFields(customFields)
                .payment(payment)
                .build();
    }

    private AdmissionResponseDetailDTO.PaymentSummary buildPayment(String studentUserId) {
        if (!StringUtils.hasText(studentUserId)) {
            return AdmissionResponseDetailDTO.PaymentSummary.builder()
                    .summaryStatus("NONE")
                    .items(List.of())
                    .build();
        }

        List<StudentFeePayment> payments = studentFeePaymentRepository.findByUserId(studentUserId);
        if (payments == null || payments.isEmpty()) {
            return AdmissionResponseDetailDTO.PaymentSummary.builder()
                    .summaryStatus("NONE")
                    .items(List.of())
                    .build();
        }

        List<AdmissionResponseDetailDTO.PaymentItem> items = payments.stream()
                .map(p -> AdmissionResponseDetailDTO.PaymentItem.builder()
                        .paymentId(p.getId())
                        .status(p.getStatus())
                        .amountExpected(p.getAmountExpected())
                        .amountPaid(p.getAmountPaid())
                        .dueDate(p.getDueDate())
                        .cpoId(p.getCpoId())
                        .feeTypeId(p.getFeeTypeId())
                        .build())
                .toList();

        String summary = summarizePaymentStatus(payments.stream().map(StudentFeePayment::getStatus).toList());
        return AdmissionResponseDetailDTO.PaymentSummary.builder()
                .summaryStatus(summary)
                .items(items)
                .build();
    }

    private String summarizePaymentStatus(List<String> statuses) {
        if (statuses == null || statuses.isEmpty()) return "NONE";
        Set<String> s = statuses.stream().filter(Objects::nonNull).map(String::toUpperCase).collect(Collectors.toSet());
        if (s.contains("PARTIAL_PAID")) return "IN_PROGRESS";
        if (s.contains("PENDING") || s.contains("OVERDUE")) return "PENDING";
        if (s.size() == 1 && s.contains("PAID")) return "PAID";
        if (s.contains("PAID") && (s.contains("PENDING") || s.contains("OVERDUE"))) return "IN_PROGRESS";
        return "IN_PROGRESS";
    }
}


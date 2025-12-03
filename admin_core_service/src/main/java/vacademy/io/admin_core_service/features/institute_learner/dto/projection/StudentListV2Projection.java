package vacademy.io.admin_core_service.features.institute_learner.dto.projection;

public interface StudentListV2Projection {
    String getFullName();
    String getEmail();
    String getUsername();
    String getPhone();
    String getPackageSessionId();
    Integer getAccessDays();
    String getPaymentStatus();
    String getCustomFieldsJson();
    String getUserId();
    String getId();
    String getAddressLine();
    String getRegion();
    String getCity();
    String getPinCode();
    String getDateOfBirth();
    String getGender();
    String getFathersName();
    String getMothersName();
    String getParentsMobileNumber();
    String getParentsEmail();
    String getLinkedInstituteName();
    String getCreatedAt();
    String getUpdatedAt();
    String getFaceFileId();
    String getExpiryDate();
    String getParentsToMotherMobileNumber();
    String getParentsToMotherEmail();
    String getInstituteEnrollmentNumber();
    String getInstituteId();
    String getGroupId();
    String getStatus();
    String getPaymentPlanJson();
    String getPaymentOptionJson();
    String getDestinationPackageSessionId();
    String getEnrollInviteId();

    // ---- ADDED FIELDS ----
    Double getPaymentAmount();
    String getSource();
    String getType();
    String getTypeId();

    String getDesiredLevelId();

    String getSubOrgId();
    String getSubOrgName();
}
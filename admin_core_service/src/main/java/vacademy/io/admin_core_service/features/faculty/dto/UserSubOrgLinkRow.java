package vacademy.io.admin_core_service.features.faculty.dto;

/**
 * Projection for a distinct (user, sub-org) pair derived from SUB_ORG-linked FSPSSM rows.
 * Used to surface each user's linked sub-org(s) on the institute Teams list.
 */
public interface UserSubOrgLinkRow {
    String getUserId();
    String getSubOrgId();
}

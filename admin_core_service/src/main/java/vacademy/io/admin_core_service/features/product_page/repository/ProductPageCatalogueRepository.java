package vacademy.io.admin_core_service.features.product_page.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.product_page.dto.ProductPageCatalogueSessionRow;
import vacademy.io.admin_core_service.features.product_page.entity.ProductPage;

import java.util.List;

/**
 * What the catalogue sync reads: every package session the institute's public
 * catalogue sells, and the bridge row + plan it is priced with there.
 */
@Repository
public interface ProductPageCatalogueRepository extends org.springframework.data.repository.Repository<ProductPage, String> {

    /**
     * One row per catalogue package session, with the SAME bridge row and plan
     * the public v2 search (PackageRepository.getOpenCatalogPackageDetailV2 and
     * getCatalogPackageDetailV2) shows on the Courses page, so a store page
     * built from these rows charges what the Courses page says.
     *
     * The rules are copied from the v2 query, not shared with it:
     * <ul>
     *   <li>catalogue scope: packages published to the catalogue and linked to
     *       the institute, package ACTIVE, package session ACTIVE or HIDDEN,
     *       level ACTIVE (the v2 call passes exactly these);</li>
     *   <li>per session, among its ACTIVE bridge rows joined to an ACTIVE
     *       payment option and that option's ACTIVE plans: the most recently
     *       updated bridge row first, then the cheapest plan. v2 leaves exact
     *       ties to the database; here the ids break them so a sync is
     *       repeatable;</li>
     *   <li>the DEFAULT tag is NOT part of the choice (in v2 it only decides
     *       whether enroll_invite_id is reported), so the bridge row may belong
     *       to another invite. Its invite is joined here regardless of tag, so
     *       the sync can check that it is really open.</li>
     * </ul>
     * Rows come back in a stable catalogue order (course, level, session), the
     * order new mappings are appended in.
     *
     * payment_info is limited to the institute's packages (a superset of the
     * catalogue's sessions; the choice is made per session, so the extra ones
     * change nothing) rather than to the catalogue_sessions CTE itself: a bind
     * parameter inside a CTE that another CTE reads is not handled the same
     * way by every engine (H2 silently returns no rows), and this form needs
     * no such reference.
     */
    @Query(value = """
            WITH catalogue_sessions AS (
                SELECT DISTINCT
                    ps.id AS package_session_id,
                    p.id AS package_id,
                    p.package_name AS package_name,
                    l.level_name AS level_name,
                    s.session_name AS session_name
                FROM package p
                JOIN package_session ps ON ps.package_id = p.id
                JOIN level l ON l.id = ps.level_id
                LEFT JOIN session s ON s.id = ps.session_id
                JOIN package_institute pi ON pi.package_id = p.id
                WHERE p.is_course_published_to_catalaouge = true
                    AND pi.institute_id = :instituteId
                    AND p.status IN (:packageStatuses)
                    AND ps.status IN (:packageSessionStatuses)
                    AND l.status IN (:levelStatuses)
            ),
            payment_info AS (
                SELECT
                    ps.id AS package_session_id,
                    psli.id AS psli_id,
                    psli.enroll_invite_id AS psli_enroll_invite_id,
                    po.id AS payment_option_id,
                    po.type AS payment_option_type,
                    pp.id AS payment_plan_id,
                    pp.actual_price AS actual_price,
                    pp.currency AS plan_currency,
                    ROW_NUMBER() OVER (
                        PARTITION BY ps.id
                        ORDER BY psli.updated_at DESC NULLS LAST, pp.actual_price ASC NULLS LAST,
                                 psli.id ASC, pp.id ASC
                    ) AS row_num
                FROM package_session ps
                LEFT JOIN package_session_learner_invitation_to_payment_option psli
                    ON ps.id = psli.package_session_id AND psli.status = :activeStatus
                LEFT JOIN payment_option po
                    ON po.id = psli.payment_option_id AND po.status = :activeStatus
                LEFT JOIN payment_plan pp
                    ON pp.payment_option_id = po.id AND pp.status = :activeStatus
                WHERE ps.package_id IN (
                    SELECT pi2.package_id FROM package_institute pi2 WHERE pi2.institute_id = :instituteId
                )
            )
            SELECT
                cs.package_session_id AS packageSessionId,
                cs.package_id AS packageId,
                cs.package_name AS packageName,
                cs.level_name AS levelName,
                cs.session_name AS sessionName,
                pinfo.psli_id AS psliId,
                ei.id AS inviteId,
                ei.status AS inviteStatus,
                ei.tag AS inviteTag,
                ei.start_date AS inviteStartDate,
                ei.end_date AS inviteEndDate,
                ei.vendor AS inviteVendor,
                ei.currency AS inviteCurrency,
                pinfo.payment_option_id AS paymentOptionId,
                pinfo.payment_option_type AS paymentOptionType,
                pinfo.payment_plan_id AS paymentPlanId,
                pinfo.actual_price AS actualPrice,
                pinfo.plan_currency AS planCurrency
            FROM catalogue_sessions cs
            LEFT JOIN payment_info pinfo
                ON pinfo.package_session_id = cs.package_session_id AND pinfo.row_num = 1
            LEFT JOIN enroll_invite ei ON ei.id = pinfo.psli_enroll_invite_id
            ORDER BY LOWER(cs.package_name) ASC, LOWER(cs.level_name) ASC,
                     LOWER(cs.session_name) ASC NULLS FIRST, cs.package_session_id ASC
            """, nativeQuery = true)
    List<ProductPageCatalogueSessionRow> findCatalogueSessions(
            @Param("instituteId") String instituteId,
            @Param("packageStatuses") List<String> packageStatuses,
            @Param("packageSessionStatuses") List<String> packageSessionStatuses,
            @Param("levelStatuses") List<String> levelStatuses,
            @Param("activeStatus") String activeStatus);
}

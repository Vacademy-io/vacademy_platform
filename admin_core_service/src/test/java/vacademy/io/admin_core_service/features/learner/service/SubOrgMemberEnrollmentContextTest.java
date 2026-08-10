package vacademy.io.admin_core_service.features.learner.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pins the SUB_ORG_MEMBER_ENROLLMENT workflow context.
 *
 * <p>Workflow nodes are authored against context keys and stored as data, so the compiler cannot
 * catch a renamed or dropped key — and neither can the engine at runtime: a SEND_EMAIL that
 * resolves zero recipients reports {@code successCount: 0} and the execution still completes
 * GREEN. Vet Education's welcome email failed silently that way for every sub-org enrollment,
 * because the node reads {@code #ctx['user']} while this event published only {@code member}.
 *
 * <p>So these assertions are the only thing standing between a one-word edit and another silent
 * outage. If one fails, a live workflow is about to stop resolving its recipient.
 */
class SubOrgMemberEnrollmentContextTest {

    private static PackageSession packageSession(String psId, String packageId) {
        PackageEntity pkg = new PackageEntity();
        pkg.setId(packageId);
        PackageSession ps = new PackageSession();
        ps.setId(psId);
        ps.setPackageEntity(pkg);
        return ps;
    }

    private static UserDTO user(String id, String email) {
        UserDTO u = new UserDTO();
        u.setId(id);
        u.setEmail(email);
        return u;
    }

    @Test
    @DisplayName("publishes the member under BOTH 'member' and 'user' — nodes exist for each key")
    void publishesMemberUnderBothKeys() {
        UserDTO member = user("u-1", "staff@example.com");

        Map<String, Object> ctx = SubOrgMemberEnrollmentContext.build(
                member, user("admin-1", "admin@example.com"), packageSession("ps-1", "pkg-1"));

        assertTrue(ctx.containsKey("member"), "'member' is the historical key — removing it breaks every existing sub-org workflow");
        assertTrue(ctx.containsKey("user"), "'user' is what LEARNER_BATCH_ENROLLMENT publishes; nodes shared between the two events read it");
        assertSame(member, ctx.get("member"));
        assertSame(member, ctx.get("user"), "both keys must resolve to the same person, not a copy");
    }

    @Test
    @DisplayName("subOrgAdmin is the sub-org's leader, kept distinct from whoever enrolled")
    void subOrgAdminIsTheLeaderNotTheActor() {
        UserDTO leader = user("leader-1", "leader@practice.com.au");
        UserDTO actor = user("platform-1", "platformadmin@vidyayatan.com");

        Map<String, Object> ctx = SubOrgMemberEnrollmentContext.build(
                user("u-1", "staff@example.com"), leader, actor, packageSession("ps-1", "pkg-1"));

        // Nodes resolve the practice's LearnDash group from subOrgAdmin's email. If the acting
        // platform admin leaks into this key the lookup 404s — or silently returns THEIR group
        // and files the member under the wrong practice.
        assertSame(leader, ctx.get("subOrgAdmin"));
        assertSame(actor, ctx.get("enrolledBy"));
    }

    @Test
    @DisplayName("a sub-org with no resolvable leader publishes null, never the actor")
    void neverSubstitutesTheActorForAMissingLeader() {
        UserDTO actor = user("platform-1", "platformadmin@vidyayatan.com");

        Map<String, Object> ctx = SubOrgMemberEnrollmentContext.build(
                user("u-1", "staff@example.com"), null, actor, packageSession("ps-1", "pkg-1"));

        // No group is a better outcome than the wrong group: the practice-group node skips on a
        // null lookup, whereas the actor's email would resolve to a real but unrelated practice.
        assertNull(ctx.get("subOrgAdmin"));
        assertSame(actor, ctx.get("enrolledBy"));
    }

    @Test
    @DisplayName("the 3-arg overload treats the actor as the leader (add-member route)")
    void threeArgOverloadKeepsAddMemberSemantics() {
        UserDTO practiceAdmin = user("admin-1", "admin@practice.com.au");

        Map<String, Object> ctx = SubOrgMemberEnrollmentContext.build(
                user("u-1", "staff@example.com"), practiceAdmin, packageSession("ps-1", "pkg-1"));

        // On /sub-org/v1/add-member the caller IS the practice admin, so both keys are the same
        // person and the existing lookup keeps working unchanged.
        assertSame(practiceAdmin, ctx.get("subOrgAdmin"));
        assertSame(practiceAdmin, ctx.get("enrolledBy"));
    }

    @Test
    @DisplayName("carries the batch/package identifiers workflow nodes route on")
    void carriesRoutingIdentifiers() {
        Map<String, Object> ctx = SubOrgMemberEnrollmentContext.build(
                user("u-1", "staff@example.com"), null, packageSession("ps-1", "pkg-1"));

        assertEquals("ps-1", ctx.get("packageSessionIds"));
        assertEquals("pkg-1", ctx.get("packageId"));
    }

    @Test
    @DisplayName("a missing admin or package does not blow up the enrollment")
    void tolerantOfMissingOptionalData() {
        // subOrgAdmin is null whenever the acting admin can't be resolved from auth-service, and
        // an enrollment must never fail just because its workflow context is thin.
        Map<String, Object> ctx = SubOrgMemberEnrollmentContext.build(
                user("u-1", "staff@example.com"), null, packageSession("ps-1", null));

        assertTrue(ctx.containsKey("subOrgAdmin"));
        assertNull(ctx.get("subOrgAdmin"));
        assertEquals("ps-1", ctx.get("packageSessionIds"));
        assertNull(ctx.get("packageId"));
    }

    @Test
    @DisplayName("a null package session degrades instead of throwing")
    void tolerantOfNullPackageSession() {
        Map<String, Object> ctx = SubOrgMemberEnrollmentContext.build(
                user("u-1", "staff@example.com"), null, null);

        assertNull(ctx.get("packageSessionIds"));
        assertNull(ctx.get("packageId"));
        assertSame(ctx.get("member"), ctx.get("user"));
    }
}

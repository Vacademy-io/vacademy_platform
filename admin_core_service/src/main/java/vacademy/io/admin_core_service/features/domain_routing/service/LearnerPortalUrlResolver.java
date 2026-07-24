package vacademy.io.admin_core_service.features.domain_routing.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.domain_routing.entity.InstituteDomainRouting;
import vacademy.io.admin_core_service.features.domain_routing.repository.InstituteDomainRoutingRepository;
import vacademy.io.common.institute.entity.Institute;

import java.util.Optional;

/**
 * Resolves the learner-portal base URL to use when linking a learner into their institute's
 * (white-label) portal from an outbound email or notification.
 *
 * <p>Resolution order: {@link Institute#getLearnerPortalBaseUrl()} →
 * <code>institute_domain_routing</code> (role=LEARNER) → the <code>default.learner.portal.url</code>
 * config value. The returned origin always carries a scheme and never a trailing slash, so callers
 * can append a path directly.
 *
 * <p><b>Why the column is consulted before domain routing</b>, unlike some other features here:
 * <code>institute_domain_routing</code> holds many <code>role='LEARNER'</code> rows per institute
 * and the only finder for it is an unordered <code>LIMIT 1</code>. In prod that table is polluted —
 * over half of one institute's LEARNER rows are actually <code>admin-*</code> portals, another
 * institute has a <code>*.localhost</code> row, and stale pre-rebrand domains linger. Picking from
 * it first emails learners an arbitrary, often wrong host. The
 * <code>institutes.learner_portal_base_url</code> column is one-per-institute and curated, so it
 * wins. Routing is still consulted as a fallback because it is the only place a branded domain
 * exists for institutes whose column is unset (sub-orgs in particular), and every such institute
 * today has exactly one clean LEARNER row.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LearnerPortalUrlResolver {

    private static final String LEARNER_ROLE = "LEARNER";
    private static final String FALLBACK_LEARNER_PORTAL_URL = "https://learner.vacademy.io";

    private final InstituteDomainRoutingRepository domainRoutingRepository;

    @Value("${default.learner.portal.url:" + FALLBACK_LEARNER_PORTAL_URL + "}")
    private String defaultLearnerPortalUrl;

    /**
     * Returns the learner-portal origin for the institute, e.g. {@code https://student.chanakyaias.in}.
     * Never null and never trailing-slashed. {@code institute} is optional — pass what is at hand
     * and the chain degrades to the configured default.
     *
     * <p>Bad data never throws — every tier degrades to the next. A failing tier-2 <em>query</em> is
     * a different matter: the repository participates in the caller's transaction, so Spring has
     * already flagged it rollback-only by the time the catch below runs. The catch keeps this method
     * from being the visible cause; it cannot rescue the caller's transaction, and nothing at this
     * layer can. Callers wanting a genuinely best-effort link must guard their own call.
     */
    public String resolveBaseUrl(String instituteId, Institute institute) {
        String fromColumn = reachableOrNull(institute == null ? null : institute.getLearnerPortalBaseUrl(),
                "learner_portal_base_url", instituteId);
        if (fromColumn != null) {
            return fromColumn;
        }

        String fromRouting = fromDomainRouting(instituteId);
        if (fromRouting != null) {
            return fromRouting;
        }

        return defaultBaseUrl();
    }

    /**
     * Only consulted when the institute has no usable {@code learner_portal_base_url}, so the
     * extra read costs nothing for the institutes that do.
     */
    private String fromDomainRouting(String instituteId) {
        if (!StringUtils.hasText(instituteId)) {
            return null;
        }
        try {
            Optional<InstituteDomainRouting> routingOpt =
                    domainRoutingRepository.findByInstituteIdAndRole(instituteId, LEARNER_ROLE);
            if (routingOpt.isEmpty() || !StringUtils.hasText(routingOpt.get().getDomain())) {
                return null;
            }
            InstituteDomainRouting routing = routingOpt.get();
            String domain = routing.getDomain().trim().replaceAll("^https?://", "").replaceAll("/$", "");
            String subdomain = routing.getSubdomain();
            // A wildcard subdomain is a catch-all marker, not a real label to prepend.
            String host = (!StringUtils.hasText(subdomain) || "*".equals(subdomain.trim()))
                    ? domain
                    : subdomain.trim() + "." + domain;
            return reachableOrNull(host, "institute_domain_routing", instituteId);
        } catch (Exception e) {
            // Does not save the caller's transaction — see resolveBaseUrl's javadoc.
            log.warn("Domain routing lookup failed for institute {}: {}", instituteId, e.getMessage());
            return null;
        }
    }

    private String defaultBaseUrl() {
        String configured = reachableOrNull(defaultLearnerPortalUrl, "default.learner.portal.url", null);
        return configured != null ? configured : FALLBACK_LEARNER_PORTAL_URL;
    }

    /** Normalizes a candidate origin, returning null when it would be a dead link in an email. */
    private String reachableOrNull(String candidate, String source, String instituteId) {
        if (!StringUtils.hasText(candidate)) {
            return null;
        }
        String base = normalize(candidate);
        if (isUnreachable(hostOf(base))) {
            log.warn("Ignoring {} value '{}' for institute {} — not reachable from an email",
                    source, candidate, instituteId);
            return null;
        }
        return base;
    }

    /** Forces a scheme and strips any trailing slash, so a path can be appended directly. */
    private String normalize(String base) {
        String url = base.trim();
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
        }
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        return url;
    }

    private String hostOf(String url) {
        String host = url.replaceAll("^https?://", "");
        int slash = host.indexOf('/');
        return slash >= 0 ? host.substring(0, slash) : host;
    }

    /**
     * A host is unreachable from an emailed link when it points at the local machine or isn't a
     * real public hostname: {@code localhost}/{@code *.localhost}, loopback IPs, or a bare label
     * with no dot (e.g. {@code student}). Public FQDNs and IPv4 addresses pass.
     */
    private boolean isUnreachable(String host) {
        if (!StringUtils.hasText(host)) return true;
        String h = host.toLowerCase().trim();
        int colon = h.indexOf(':');
        if (colon > 0) h = h.substring(0, colon);
        if (h.equals("localhost") || h.endsWith(".localhost")) return true;
        if (h.equals("127.0.0.1") || h.equals("0.0.0.0") || h.equals("::1")) return true;
        return !h.contains(".");
    }
}

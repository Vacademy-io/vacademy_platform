package vacademy.io.admin_core_service.features.reporting.spi;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Auto-collects every {@link ReportSection} bean — the DataPointRegistry idiom.
 *
 * Unknown keys in a saved schedule are warned and skipped rather than failing the
 * run: a section can be renamed or withdrawn without breaking every schedule that
 * referenced it, and the institute still gets the rest of their report.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class ReportSectionRegistry {

    private final List<ReportSection> sections;

    public List<ReportSection> all() {
        return sections;
    }

    public ReportSection byKey(String key) {
        return sections.stream().filter(s -> s.key().equals(key)).findFirst().orElse(null);
    }

    /** Sections this institute can actually populate — drives the config screen. */
    public List<ReportSection> availableFor(String instituteId) {
        List<ReportSection> out = new ArrayList<>();
        for (ReportSection s : sections) {
            try {
                if (s.isAvailableFor(instituteId)) out.add(s);
            } catch (Exception e) {
                // Availability is a hint, not a correctness boundary. A probe that
                // fails should not blank the configuration screen.
                log.warn("[reporting] availability probe failed for section '{}' institute {} — hiding it",
                        s.key(), instituteId, e);
            }
        }
        return out;
    }

    /**
     * Resolve a saved selection to live sections, filtered to what this recipient's
     * role may see. Order follows registry order so a report reads consistently.
     */
    public List<ReportSection> resolve(List<String> selectedKeys, Set<String> recipientRoles) {
        List<ReportSection> resolved = new ArrayList<>();
        if (selectedKeys == null) return resolved;

        for (ReportSection s : sections) {
            if (!selectedKeys.contains(s.key())) continue;
            if (recipientRoles != null && s.visibleToRoles().stream().noneMatch(recipientRoles::contains)) {
                continue; // not for this reader
            }
            resolved.add(s);
        }
        for (String key : selectedKeys) {
            if (byKey(key) == null) {
                log.warn("[reporting] schedule selected unknown section '{}' — skipped (renamed or withdrawn?)", key);
            }
        }
        return resolved;
    }
}

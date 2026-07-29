package vacademy.io.community_service.feature.pricing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/** One student bracket from the rate card, with everything the FE needs to render its card. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BracketDto {
    private String code;
    private String name;
    private int maxStudents;
    private BigDecimal perStudentPerYear;
    private BigDecimal lmsAnnual;
    private BigDecimal parentAppPerStudent;

    private boolean androidIncluded;
    private boolean iosIncluded;
    private boolean websiteIncluded;
    private boolean commsIncluded;
    private int includedSubOrgs;
    private boolean premiumSupportIncluded;

    /** Human-readable "what you get at this level" bullets. */
    private List<String> includes;
}

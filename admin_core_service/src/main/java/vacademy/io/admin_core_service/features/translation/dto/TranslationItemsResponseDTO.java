package vacademy.io.admin_core_service.features.translation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * Paged listing of translation review items for one (packageSession, locale),
 * optionally filtered by state. Serves the admin Translation review screen.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TranslationItemsResponseDTO {

    @JsonProperty("package_session_id")
    private String packageSessionId;

    @JsonProperty("locale")
    private String locale;

    /** Echo of the state filter; null when unfiltered. */
    @JsonProperty("state")
    private String state;

    @JsonProperty("page")
    private int page;

    @JsonProperty("size")
    private int size;

    @JsonProperty("total_elements")
    private long totalElements;

    @JsonProperty("total_pages")
    private int totalPages;

    @JsonProperty("items")
    private List<TranslationReviewItemDTO> items;
}

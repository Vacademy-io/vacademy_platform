package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class AutocompleteResponseDTO {
    private List<PackageSuggestionDTO> suggestions;
    private Integer totalMatches;
    private Long queryTimeMs;

    public AutocompleteResponseDTO() {
    }

    public AutocompleteResponseDTO(List<PackageSuggestionDTO> suggestions, Integer totalMatches, Long queryTimeMs) {
        this.suggestions = suggestions;
        this.totalMatches = totalMatches;
        this.queryTimeMs = queryTimeMs;
    }

    public List<PackageSuggestionDTO> getSuggestions() {
        return suggestions;
    }

    public void setSuggestions(List<PackageSuggestionDTO> suggestions) {
        this.suggestions = suggestions;
    }

    public Integer getTotalMatches() {
        return totalMatches;
    }

    public void setTotalMatches(Integer totalMatches) {
        this.totalMatches = totalMatches;
    }

    public Long getQueryTimeMs() {
        return queryTimeMs;
    }

    public void setQueryTimeMs(Long queryTimeMs) {
        this.queryTimeMs = queryTimeMs;
    }
}

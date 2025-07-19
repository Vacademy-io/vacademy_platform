package vacademy.io.media_service.course.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class UnsplashSearchResponse {
    private int total;
    private int total_pages;
    private List<UnsplashPhoto> results;
}

package vacademy.io.media_service.course.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UnsplashPhoto {
    private String id;
    private Urls urls;



    @Getter
    @Setter
    public static class Urls {
        private String raw;
        private String small;
        private String full;
    }
}

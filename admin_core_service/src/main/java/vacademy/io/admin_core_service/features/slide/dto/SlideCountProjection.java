package vacademy.io.admin_core_service.features.slide.dto;

public class SlideCountProjection {
    private String slideType;
    private Long totalSlides;

    // Constructor
    public SlideCountProjection(String slideType, Long totalSlides) {
        this.slideType = slideType;
        this.totalSlides = totalSlides;
    }

    // Getters and setters
    public String getSlideType() {
        return slideType;
    }

    public void setSlideType(String slideType) {
        this.slideType = slideType;
    }

    public Long getTotalSlides() {
        return totalSlides;
    }

    public void setTotalSlides(Long totalSlides) {
        this.totalSlides = totalSlides;
    }
}
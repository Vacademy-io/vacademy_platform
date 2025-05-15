package vacademy.io.media_service.constant;

public class IncidentType {
    private String category;
    private String subcategory;

    // Constructor
    public IncidentType(String category, String subcategory) {
        this.category = category;
        this.subcategory = subcategory;
    }

    // Getters
    public String getCategory() {
        return category;
    }

    public String getSubcategory() {
        return subcategory;
    }

    // Optional: toString for easy printing
    @Override
    public String toString() {
        return "IncidentType{category='" + category + "', subcategory='" + subcategory + "'}";
    }
}
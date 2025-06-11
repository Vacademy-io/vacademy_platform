package vacademy.io.media_service.presentation.dto;


import lombok.Data;
import lombok.Getter;
import lombok.Setter;


public class AppState {
    public String viewBackgroundColor = "#ffffff";

    public void setViewBackgroundColor(String backgroundColor) {
        this.viewBackgroundColor = backgroundColor;
    }
}
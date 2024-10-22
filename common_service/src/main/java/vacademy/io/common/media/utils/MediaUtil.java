package vacademy.io.common.media.utils;


import java.util.ArrayList;
import java.util.List;

public class MediaUtil {
    public static List<String> getFileIdsFromParam(String fileIds) {
        return new ArrayList<>(List.of(fileIds.split(",")));
    }
}

import java.util.Base64;
import java.nio.charset.StandardCharsets;

public class test_base64_fix {
    public static void main(String[] args) {
        String encodedState = "eyJmcm9tIjoiaHR0cDovL2xlYXJuZXIubG9jYWxob3N0OjUxNzMvb2F1dGgtcG9wdXAtaGFuZGxlci5odG1sIiwiYWNjb3VudF90eXBlIjoic2lnbnVwIiwidXNlcl90eXBlIjoibGVhcm5lciIsImluc3RpdHV0ZV9pZCI6ImRmNmZhZWNkLTA0MzctNDcwMC04MzczLTZjNjQyYzg2MmMzNyIsInJlZGlyZWN0VG8iOiIvc3R1ZHktbGlicmFyeS9jb3Vyc2VzL2NvdXJzZS1kZXRhaWxzP2NvdXJzZUlkPTE3MmNhMDEyLTNlYmUtNGFlOS05ZmQwLTE1YTBjNGY0YzAyOCZzZWxlY3RlZFRhYj1BTEwiLCJjdXJyZW50VXJsIjoiL2NvdXJzZXMvY291cnNlLWRldGFpbHM/Y291cnNlSWQ9MTcyY2EwMTItM2ViZS00YWU5LTlmZDAtMTVhMGM0ZjRjMDI4IiwiaXNNb2RhbFNpZ251cCI6dHJ1ZX0=";
        
        System.out.println("Testing Base64 decoding fix...");
        System.out.println("Encoded state: " + encodedState);
        
        byte[] decodedBytes;
        
        // Try URL-safe Base64 decoding first, then fall back to standard Base64
        try {
            decodedBytes = Base64.getUrlDecoder().decode(encodedState);
            System.out.println("SUCCESS: Decoded using URL-safe Base64 decoder");
        } catch (IllegalArgumentException e) {
            System.out.println("URL-safe Base64 decoding failed: " + e.getMessage());
            System.out.println("Trying standard Base64 decoder...");
            try {
                decodedBytes = Base64.getDecoder().decode(encodedState);
                System.out.println("SUCCESS: Decoded using standard Base64 decoder");
            } catch (IllegalArgumentException e2) {
                System.out.println("FAILED: Both decoders failed: " + e2.getMessage());
                return;
            }
        }
        
        String decodedJson = new String(decodedBytes, StandardCharsets.UTF_8);
        System.out.println("Decoded JSON: " + decodedJson);
    }
}

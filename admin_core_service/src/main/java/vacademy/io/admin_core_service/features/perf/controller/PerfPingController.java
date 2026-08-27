package vacademy.io.admin_core_service.features.perf.controller;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The network baseline used to answer "is the LMS slow, or is your connection slow?".
 *
 * This endpoint deliberately does NOTHING: no database, no authentication, no
 * serialization beyond a three-byte body. Its round trip is therefore almost
 * entirely network, which makes it the control that real API calls are compared
 * against. If a normal call is slow but this is fast, the time went to our server;
 * if both are slow, the time went to the network.
 *
 * Three things keep it honest, and breaking any one of them makes the baseline lie:
 *
 * 1) It must stay unauthenticated. It is listed in ApplicationSecurityConfig's
 *    ALLOWED_PATHS, and callers must NOT send an Authorization header —
 *    JwtAuthFilter returns immediately when there is no Bearer token, so an
 *    unauthenticated call skips all token parsing and user lookup. Sending a token
 *    would add real server work to the "pure network" measurement.
 *
 * 2) It must never be cached. A cached response returns in ~0ms without touching
 *    the network and the baseline silently becomes garbage, which is worse than
 *    having no baseline at all. Hence no-store here, and callers should also add a
 *    cache-busting query parameter.
 *
 * 3) Its own path must not contain the substring "internal" — InternalAuthFilter
 *    401s any such URI that lacks clientName + Signature headers.
 *
 * It is also the cheapest end-to-end check that the Server-Timing header
 * (RequestTracingFilter) is reaching browsers at all: this response should carry
 * app;dur=0 or close to it.
 */
@RestController
@RequestMapping("/admin-core-service/v1/perf")
public class PerfPingController {

    @GetMapping("/ping")
    public ResponseEntity<String> ping() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore().mustRevalidate())
                .contentType(MediaType.TEXT_PLAIN)
                .body("ok");
    }
}

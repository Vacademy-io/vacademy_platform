package vacademy.io.media_service.course.manager;



import com.ibm.icu.impl.UResource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.Disposable;
import reactor.core.publisher.FluxSink;
import reactor.core.publisher.Sinks;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class ActiveCourseGenerationManager {
    private final Map<String, Disposable> activeGenerations = new ConcurrentHashMap<>();
    private final Map<String, Sinks.Many<String>> sinkMap = new ConcurrentHashMap<>();


    /**
     * Registers a new course generation task.
     *
     * @param generationId The unique ID for the generation task.
     * @param subscription The disposable subscription of the Flux.
     */
    public void register(String generationId, Disposable subscription, Sinks.Many<String> sink){
        activeGenerations.put(generationId, subscription);
        sinkMap.put(generationId, sink);
    }


    /**
     * Removes a task from the registry, typically upon completion or error.
     *
     * @param generationId The unique ID of the task to remove.
     */
    public void remove(String generationId){
        activeGenerations.remove(generationId);
    }


    public boolean cancel(String generationId){
        boolean found = false;
        Disposable disposable = activeGenerations.remove(generationId);
        Sinks.Many<String> sink = sinkMap.remove(generationId);

        if (disposable != null) {
            disposable.dispose();
            found = true;
        }

        if (sink != null) {
            sink.tryEmitComplete();  // 💡 This closes the SSE connection
            found = true;
        }

        return found;
    }

    public boolean contains(String requestId) {
        return activeGenerations.containsKey(requestId);
    }


}

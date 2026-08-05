import inspect
# 1. Does the Plivo serializer send a clear on interruption?
from pipecat.serializers.plivo import PlivoFrameSerializer
src = inspect.getsource(PlivoFrameSerializer.serialize)
print("=== PlivoFrameSerializer.serialize ===")
print(src)

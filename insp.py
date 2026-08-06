import inspect
from pipecat.services.tts_service import TTSService, InterruptibleTTSService
from pipecat.services.websocket_service import WebsocketService
print("=== InterruptibleTTSService._handle_interruption ===")
print(inspect.getsource(InterruptibleTTSService._handle_interruption))
print("=== TTSService._handle_interruption ===")
print(inspect.getsource(TTSService._handle_interruption))
print("=== WebsocketService ===")
for n in ("_receive_task_handler", "_try_reconnect", "_reconnect_websocket",
          "_verify_connection", "_keepalive_task_handler"):
    f = getattr(WebsocketService, n, None)
    if f:
        print(f"--- {n}")
        print(inspect.getsource(f))

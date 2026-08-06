import inspect
# 3. Does the output transport pace audio in real time (small downstream buffer),
#    or dump it (big Plivo buffer, clearAudio does the work)?
from pipecat.transports.base_output import BaseOutputTransport
src = inspect.getsource(BaseOutputTransport)
import re
# find the audio-writing task
for name in ("_audio_task_handler", "_handle_frame", "_sink_task_handler"):
    for cls_attr in dir(BaseOutputTransport):
        pass
hits = [m.start() for m in re.finditer(r"async def \w*audio\w*task\w*handler|_next_send_time|MEDIA_SECS|send_interval|sleep", src)]
lines = src.splitlines()
for i, l in enumerate(lines):
    if "def _audio_task_handler" in l or "_next_send_time" in l or "send_interval" in l:
        print("\n".join(lines[max(0,i-3):i+25]))
        print("-----")
        break

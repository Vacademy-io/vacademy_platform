import inspect
from pipecat.processors.aggregators import llm_response_universal as u
# The exact user-aggregator class + pair construction + the methods I override
print("=== LLMContextAggregatorPair ===")
print(inspect.getsource(u.LLMContextAggregatorPair))
cls = u.LLMUserAggregator
print("=== user aggregator __init__ signature ===")
print(inspect.signature(cls.__init__))
for name in ("_handle_transcription", "_handle_bot_started_speaking", "_handle_bot_stopped_speaking",
             "_handle_user_stopped_speaking", "_maybe_emulate_user_speaking", "aggregation_string"):
    f = getattr(cls, name, None)
    print(f"=== {name} {'(MISSING)' if not f else ''} ===")
    if f: print(inspect.getsource(f))

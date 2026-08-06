import inspect
from pipecat.processors.aggregators.llm_response import LLMUserContextAggregator, LLMUserAggregatorParams

# 1. When does push_aggregation actually run? (the debounce task)
for name in ("_aggregation_task_handler", "_should_interrupt_based_on_strategies",
             "push_interruption_task_frame_and_wait"):
    f = getattr(LLMUserContextAggregator, name, None)
    if f:
        print(f"=== {name} ===")
        print(inspect.getsource(f))

# 2. The default debounce
import dataclasses
try:
    print("=== LLMUserAggregatorParams defaults ===")
    print(inspect.getsource(LLMUserAggregatorParams))
except Exception as e:
    print("params src err", e)

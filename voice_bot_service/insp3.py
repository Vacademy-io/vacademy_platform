import inspect
# 2. How is MinWords evaluated — on every transcription frame, or only finals?
from pipecat.audio.interruptions.min_words_interruption_strategy import MinWordsInterruptionStrategy
print("=== MinWordsInterruptionStrategy ===")
print(inspect.getsource(MinWordsInterruptionStrategy))
# 3. Where does the aggregator decide to interrupt?
from pipecat.processors.aggregators.llm_response import LLMUserContextAggregator
for name in ("_handle_transcription", "_handle_interim_transcription", "push_aggregation", "_should_interrupt", "_maybe_interrupt"):
    f = getattr(LLMUserContextAggregator, name, None)
    if f:
        print(f"=== LLMUserContextAggregator.{name} ===")
        print(inspect.getsource(f))

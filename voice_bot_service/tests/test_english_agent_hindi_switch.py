"""An English agent the caller asks to speak Hindi (call a4ce0279, 2026-10-13, Riya).

Riya's script says: English for the whole call, switch to Hindi only when asked.
The bot's own SCRIPT rule for English agents said "Latin letters only, never
Devanagari", so when the caller asked, the model wrote "main ab Hindi mein baat
karungi" in Latin letters and the English voice read it as gibberish — the caller
said "I don't understand you" and the call was lost. Navana reads Devanagari in
Hindi on its own (lang_corrected on her earlier calls), so for a Navana agent the
Hindi the caller asked for goes out in Devanagari. Other engines keep the rule.
"""
import app.bot as b


def _prompt(tts_model: str, language: str = "english") -> str:
    agent = {"id": "a1", "name": "Riya", "language": language, "voice": "ipsita",
             "tts_model": tts_model, "systemPrompt": "Speak English. Switch to Hindi only if asked. " * 20,
             "direction": "OUTBOUND", "openingLine": "Hi! This is Riya."}
    return b.build_system_prompt({"agent": agent, "instituteName": "Tutezy", "direction": "OUTBOUND"})


def test_navana_english_agent_writes_requested_hindi_in_devanagari():
    p = _prompt("navana")
    assert "write every Hindi sentence in DEVANAGARI" in p
    assert "NEVER write Hindi in Latin letters" in p
    # Still English by default: the exception is only for Hindi the caller asked for.
    assert "Write your replies in English (Latin letters)" in p
    assert "Write every reply in English (Latin letters) only" not in p


def test_other_engines_keep_the_latin_only_rule():
    for engine in ("smallest_pro", "sarvam", "rumik"):
        p = _prompt(engine)
        assert "Write every reply in English (Latin letters) only" in p, engine
        assert "write every Hindi sentence in DEVANAGARI" not in p, engine


def test_hinglish_agents_are_untouched():
    p = _prompt("navana", language="hinglish")
    assert "Write Hindi words in DEVANAGARI" in p
    assert "ONE exception: if the caller has asked you to speak Hindi" not in p

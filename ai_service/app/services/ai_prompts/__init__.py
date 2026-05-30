"""Ported prompt templates from media_service ConstantAiTemplate.

Templates are copied VERBATIM (literal JSON braces kept doubled as ``{{``/``}}``)
so that Python ``str.format(**vars)`` reproduces Spring PromptTemplate behavior
exactly: it fills the named placeholders and collapses doubled braces to single.
"""

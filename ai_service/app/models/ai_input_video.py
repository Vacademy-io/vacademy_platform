"""
Backwards-compat shim. The model was renamed to AiInputAsset (table
ai_input_assets) when the indexing pipeline was generalized to images.
Existing imports of AiInputVideo continue to work via this re-export and
will be removed once all callers are updated to AiInputAsset.
"""
from .ai_input_asset import AiInputAsset as AiInputVideo

__all__ = ["AiInputVideo"]

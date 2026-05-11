"""
Backwards-compat shim. The repository was renamed to AiInputAssetRepository
when the indexing pipeline was generalized to images. Existing imports of
AiInputVideoRepository continue to work via this re-export and will be
removed once all callers are updated to AiInputAssetRepository.

NOTE: AiInputAssetRepository.create() now requires a `kind` argument.
Callers that use the old class will fail at create time until they pass kind.
The list_by_institute signature gains an optional kind filter.
"""
from .ai_input_asset_repository import AiInputAssetRepository as AiInputVideoRepository

__all__ = ["AiInputVideoRepository"]

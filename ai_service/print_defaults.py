from app.db.session import SessionLocal
from app.repositories.ai_models_repository import AIModelsRepository
from pprint import pprint

db = SessionLocal()
try:
    repo = AIModelsRepository(db)
    defaults = repo.get_all_defaults()
    print("USE_CASE | DEFAULT_MODEL | FALLBACK_MODEL | FREE_TIER_MODEL")
    print("-" * 70)
    for d in defaults:
        print(f"{d.use_case} | {d.default_model_id} | {d.fallback_model_id} | {d.free_tier_model_id}")
finally:
    db.close()

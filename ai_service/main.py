from fastapi import FastAPI
from ai_service.app.app_factory import create_app
from ai_service.app.config import get_settings


app: FastAPI = create_app()


# Compatibility route kept at the same path
@app.get(f"{get_settings().api_base_path}/hello")
def hello_world() -> dict:
    return {"message": "hello world"}

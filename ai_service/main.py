from fastapi import FastAPI, Response, status

app = FastAPI(
    title="AI Service",
    description="Vacademy AI Service",
    version="0.1.0",
    docs_url="/ai-service/docs",
    redoc_url=None,
    openapi_url="/ai-service/openapi.json",
)


@app.get("/ai-service/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/ai-service/hello")
def hello_world() -> dict:
    return {"message": "hello world"}



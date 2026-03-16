from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from rembg import remove
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/remove-bg")
async def remove_background(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    data = await file.read()
    result = remove(data)

    return Response(
        content=result,
        media_type="image/png",
        headers={"Content-Disposition": f"attachment; filename=nobg.png"}
    )

@app.get("/api/health")
def health():
    return {"status": "ok"}

# Serve React frontend (must be last)
static_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

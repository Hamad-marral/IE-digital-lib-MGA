import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from .database import BASE_DIR, UPLOAD_DIR, Base, SessionLocal, engine
from .importer import import_blocks, parse_workbook
from .migrate import add_category_units, ensure_units, mark_seeded, seeded_units
from .models import Category, User
from .routers import auth, categories, dashboard, folders, public, reports, settings, transactions, units, users
from .security import hash_password

PROJECT_DIR = BASE_DIR.parent
SEED_EXCEL = Path(os.getenv("SEED_EXCEL", PROJECT_DIR / "Folder Data" / "Folders Detail.xlsx"))
SEED_EXCEL_UNIT2 = Path(os.getenv("SEED_EXCEL_UNIT2", PROJECT_DIR / "Folder Data" / "Folder  Guage set unit 2.xlsx"))
SEED_FILES = {"U1": SEED_EXCEL, "U2": SEED_EXCEL_UNIT2}
FRONTEND_DIST = PROJECT_DIR / "frontend" / "dist"


def seed():
    Base.metadata.create_all(engine)
    add_category_units(engine)
    with SessionLocal() as db:
        if not db.scalar(select(User).limit(1)):
            db.add(User(name="IE Admin", email="admin@ie.local", role="admin",
                        password_hash=hash_password(os.getenv("ADMIN_PASSWORD", "admin123"))))
            db.commit()
        done = seeded_units(db)
        for unit in ensure_units(db):
            # Each unit is seeded from its sheet once; later changes come through Settings -> Import.
            path = SEED_FILES.get(unit.code)
            if unit.code in done:
                continue
            if not db.scalar(select(Category).where(Category.unit_id == unit.id).limit(1)) and path and path.exists():
                stats = import_blocks(db, parse_workbook(path), unit=unit)
                print(f"[seed] {unit.name}: imported {path.name}: {stats}")
            done.add(unit.code)
        mark_seeded(db, done)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    seed()
    yield


app = FastAPI(title="Folder and Gauge Set Library API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

for r in (auth, units, categories, folders, transactions, dashboard, reports, users, settings, public):
    app.include_router(r.router)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve the built React app (npm run build) with SPA fallback.
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404)
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")

import io
import json

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..importer import import_blocks, parse_workbook
from ..models import Category, Folder, Setting, Unit, User
from ..security import admin_only, current_user

router = APIRouter(prefix="/api", tags=["settings"])

DEFAULTS = {
    "lines": [f"Line {i}" for i in range(1, 13)],
    "default_min_qty": 1,
    "company": "Industrial Engineering Department",
    "qr_base_url": "",  # e.g. http://192.168.1.20:8000 — address phones use when scanning QR codes
}


def get_settings(db: Session) -> dict:
    stored = {s.key: json.loads(s.value) for s in db.scalars(select(Setting))}
    return {**DEFAULTS, **stored}


class SettingsIn(BaseModel):
    lines: list[str] | None = None
    default_min_qty: int | None = None
    company: str | None = None
    qr_base_url: str | None = None
    apply_min_qty_to_all: bool = False


@router.get("/settings", dependencies=[Depends(current_user)])
def read_settings(db: Session = Depends(get_db)):
    return get_settings(db)


@router.put("/settings")
def write_settings(body: SettingsIn, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    data = body.model_dump(exclude_none=True)
    apply_all = data.pop("apply_min_qty_to_all", False)
    if "lines" in data:
        data["lines"] = [l.strip() for l in data["lines"] if l.strip()]
    if "qr_base_url" in data:
        data["qr_base_url"] = data["qr_base_url"].strip().rstrip("/")
    for key, value in data.items():
        row = db.get(Setting, key) or Setting(key=key)
        row.value = json.dumps(value)
        db.merge(row)
    if apply_all and body.default_min_qty is not None:
        for f in db.scalars(select(Folder)):
            f.inventory.min_qty = body.default_min_qty
    db.commit()
    return get_settings(db)


@router.post("/import/excel")
async def import_excel(file: UploadFile = File(...), preview: bool = False, unit_id: int | None = None,
                       admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    unit = db.get(Unit, unit_id) if unit_id else None
    if not unit:
        raise HTTPException(400, "Choose which unit this sheet belongs to")
    if not (file.filename or "").lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(400, "Please upload an .xlsx file")
    try:
        blocks = parse_workbook(io.BytesIO(await file.read()))
    except Exception as exc:  # malformed workbook
        raise HTTPException(400, f"Could not read workbook: {exc}") from exc
    if not blocks:
        raise HTTPException(400, "No folder tables found. Use the Unit 1 layout (category title, then "
                                 "'SR# | Description | Qty') or the Unit 2 layout (category title, then size rows).")
    summary = [{"category": b["category"].strip(), "items": len(b["items"]), "qty": sum(i["qty"] for i in b["items"]),
                "skipped": b.get("skipped", 0), "sample": [i["description"] for i in b["items"][:3]]}
               for b in blocks]
    if preview:
        return {"preview": summary, "unit": unit.name}
    return {"preview": summary, "unit": unit.name, "result": import_blocks(db, blocks, admin.id, unit=unit)}

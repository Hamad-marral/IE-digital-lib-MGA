import uuid
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import UPLOAD_DIR, get_db
from ..importer import next_item_code, parse_description
from ..models import Attachment, Category, Folder, Inventory, Transaction, Unit, User
from ..security import can_edit, current_user
from ..serializers import folder_out, transaction_out

router = APIRouter(prefix="/api/folders", tags=["folders"], dependencies=[Depends(current_user)])

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}
DOC_EXT = {".pdf", ".dwg", ".dxf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"}


class FolderIn(BaseModel):
    category_id: int
    name: str
    description: str = ""
    size: str = ""
    variant: str = ""
    type: str = ""
    material: str = ""
    usage: str = ""
    specs: str = ""
    location: str = ""
    min_qty: int = Field(1, ge=0)
    total_qty: int = Field(0, ge=0)


class FolderUpdate(BaseModel):
    category_id: int | None = None
    name: str | None = None
    description: str | None = None
    size: str | None = None
    variant: str | None = None
    type: str | None = None
    material: str | None = None
    usage: str | None = None
    specs: str | None = None
    location: str | None = None
    min_qty: int | None = Field(None, ge=0)
    image_url: str | None = None


def get_folder(db: Session, folder_id: int) -> Folder:
    folder = db.get(Folder, folder_id)
    if not folder:
        raise HTTPException(404, "Folder not found")
    return folder


@router.get("")
def list_folders(search: str = "", category_id: int | None = None, status: str = "", type: str = "",
                 unit_id: int | None = None, db: Session = Depends(get_db)):
    q = select(Folder).join(Category).outerjoin(Unit).order_by(Unit.sort_order, Category.sort_order, Folder.item_code)
    if unit_id:
        q = q.where(Category.unit_id == unit_id)
    if category_id:
        q = q.where(Folder.category_id == category_id)
    if type:
        q = q.where(Folder.type == type)
    for term in search.lower().split():
        like = f"%{term}%"
        q = q.where(or_(func.lower(Folder.name).like(like), func.lower(Folder.item_code).like(like),
                        func.lower(Folder.size).like(like), func.lower(Folder.type).like(like),
                        func.lower(Folder.description).like(like), func.lower(Category.name).like(like),
                        func.lower(func.coalesce(Unit.name, "")).like(like)))
    items = [folder_out(f) for f in db.scalars(q)]
    if status:
        items = [i for i in items if i["status"] == status or (status == "issued" and i["issued_qty"] > 0)
                 or (status == "damaged" and i["damaged_qty"] > 0)]
    return items


@router.get("/types")
def list_types(unit_id: int | None = None, db: Session = Depends(get_db)):
    q = select(Folder.type).join(Category).distinct()
    if unit_id:
        q = q.where(Category.unit_id == unit_id)
    return sorted(t for t in db.scalars(q) if t)


@router.get("/{folder_id}")
def folder_detail(folder_id: int, db: Session = Depends(get_db)):
    return folder_out(get_folder(db, folder_id), detail=True)


@router.get("/{folder_id}/transactions")
def folder_transactions(folder_id: int, db: Session = Depends(get_db)):
    get_folder(db, folder_id)
    q = select(Transaction).where(Transaction.folder_id == folder_id).order_by(Transaction.date.desc(), Transaction.id.desc())
    return [transaction_out(t) for t in db.scalars(q)]


@router.get("/{folder_id}/outstanding")
def folder_outstanding(folder_id: int, db: Session = Depends(get_db)):
    """Quantity still out on each line (issued minus returned)."""
    get_folder(db, folder_id)
    rows = db.execute(select(Transaction.to_from, Transaction.type, func.sum(Transaction.quantity))
                      .where(Transaction.folder_id == folder_id, Transaction.type.in_(["issue", "return"]))
                      .group_by(Transaction.to_from, Transaction.type)).all()
    out: dict[str, int] = {}
    for line, ttype, qty in rows:
        out[line] = out.get(line, 0) + (qty if ttype == "issue" else -qty)
    return [{"line": k, "qty": v} for k, v in sorted(out.items()) if v > 0]


@router.post("")
def create_folder(body: FolderIn, user: User = Depends(can_edit), db: Session = Depends(get_db)):
    cat = db.get(Category, body.category_id)
    if not cat:
        raise HTTPException(404, "Category not found")
    parsed = parse_description(body.name)
    folder = Folder(category=cat, name=body.name.strip(), description=body.description or body.name.strip(),
                    size=body.size or parsed["size"], variant=body.variant or parsed["variant"],
                    type=body.type or parsed["type"], material=body.material, usage=body.usage, specs=body.specs,
                    item_code=next_item_code(db, cat))
    folder.inventory = Inventory(total_qty=body.total_qty, available_qty=body.total_qty, min_qty=body.min_qty,
                                 location=body.location)
    db.add(folder)
    db.flush()
    db.add(Transaction(folder_id=folder.id, type="add", quantity=body.total_qty, user_id=user.id, date=date.today(),
                       remarks="New folder added"))
    db.commit()
    return folder_out(folder, detail=True)


@router.put("/{folder_id}")
def update_folder(folder_id: int, body: FolderUpdate, user: User = Depends(can_edit), db: Session = Depends(get_db)):
    folder = get_folder(db, folder_id)
    data = body.model_dump(exclude_unset=True)
    if "category_id" in data and data["category_id"] != folder.category_id:
        cat = db.get(Category, data["category_id"])
        if not cat:
            raise HTTPException(404, "Category not found")
        folder.category = cat
    for key in ("location", "min_qty"):
        if key in data:
            setattr(folder.inventory, key, data.pop(key))
    data.pop("category_id", None)
    for key, value in data.items():
        setattr(folder, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    return folder_out(folder, detail=True)


@router.delete("/{folder_id}")
def delete_folder(folder_id: int, user: User = Depends(can_edit), db: Session = Depends(get_db)):
    folder = get_folder(db, folder_id)
    if folder.inventory.issued_qty > 0:
        raise HTTPException(400, "This folder still has issued quantity on lines. Return it first.")
    db.delete(folder)
    db.commit()
    return {"ok": True}


@router.post("/{folder_id}/attachments")
async def upload_attachment(folder_id: int, file: UploadFile = File(...), kind: str = Form("image"),
                            user: User = Depends(can_edit), db: Session = Depends(get_db)):
    folder = get_folder(db, folder_id)
    ext = Path(file.filename or "").suffix.lower()
    allowed = IMAGE_EXT if kind == "image" else IMAGE_EXT | DOC_EXT
    if ext not in allowed:
        raise HTTPException(400, f"File type {ext or '(none)'} is not allowed for {kind}")
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(400, "File is larger than 15 MB")
    stored = f"{folder.item_code}_{uuid.uuid4().hex[:10]}{ext}"
    (UPLOAD_DIR / stored).write_bytes(content)
    att = Attachment(folder_id=folder.id, kind=kind, filename=file.filename or stored, url=f"/uploads/{stored}")
    db.add(att)
    if kind == "image" and not folder.image_url:
        folder.image_url = att.url
    db.commit()
    return folder_out(folder, detail=True)


@router.put("/{folder_id}/attachments/{att_id}")
async def replace_attachment(folder_id: int, att_id: int, file: UploadFile = File(...),
                             user: User = Depends(can_edit), db: Session = Depends(get_db)):
    """Swap the file behind an attachment (used by the image editor). Keeps it as main photo if it was."""
    folder = get_folder(db, folder_id)
    att = db.get(Attachment, att_id)
    if not att or att.folder_id != folder.id:
        raise HTTPException(404, "Attachment not found")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in (IMAGE_EXT if att.kind == "image" else IMAGE_EXT | DOC_EXT):
        raise HTTPException(400, f"File type {ext or '(none)'} is not allowed")
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(400, "File is larger than 15 MB")
    stored = f"{folder.item_code}_{uuid.uuid4().hex[:10]}{ext}"  # new name so browsers don't show a cached copy
    (UPLOAD_DIR / stored).write_bytes(content)
    old = UPLOAD_DIR / Path(att.url).name
    if old.exists():
        old.unlink()
    new_url = f"/uploads/{stored}"
    if folder.image_url == att.url:
        folder.image_url = new_url
    att.url = new_url
    db.commit()
    db.refresh(folder)
    return folder_out(folder, detail=True)


@router.delete("/{folder_id}/attachments/{att_id}")
def delete_attachment(folder_id: int, att_id: int, user: User = Depends(can_edit), db: Session = Depends(get_db)):
    folder = get_folder(db, folder_id)
    att = db.get(Attachment, att_id)
    if not att or att.folder_id != folder.id:
        raise HTTPException(404, "Attachment not found")
    path = UPLOAD_DIR / Path(att.url).name
    if path.exists():
        path.unlink()
    if folder.image_url == att.url:
        others = [a for a in folder.attachments if a.kind == "image" and a.id != att.id]
        folder.image_url = others[0].url if others else ""
    db.delete(att)
    db.commit()
    db.refresh(folder)
    return folder_out(folder, detail=True)

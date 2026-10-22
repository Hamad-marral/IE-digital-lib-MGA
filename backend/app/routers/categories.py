from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Category, Unit
from ..security import admin_only, current_user
from ..serializers import category_out

router = APIRouter(prefix="/api/categories", tags=["categories"], dependencies=[Depends(current_user)])


class CategoryIn(BaseModel):
    unit_id: int | None = None
    name: str
    code: str
    description: str = ""
    color: str = "#2563eb"


@router.get("")
def list_categories(unit_id: int | None = None, db: Session = Depends(get_db)):
    q = select(Category).outerjoin(Unit).order_by(Unit.sort_order, Category.sort_order, Category.id)
    if unit_id:
        q = q.where(Category.unit_id == unit_id)
    return [category_out(c) for c in db.scalars(q)]


@router.post("", dependencies=[Depends(admin_only)])
def create_category(body: CategoryIn, db: Session = Depends(get_db)):
    code = body.code.strip().upper()
    unit = db.get(Unit, body.unit_id) if body.unit_id else None
    if not unit:
        raise HTTPException(400, "Choose the unit this category belongs to")
    if db.scalar(select(Category).where(Category.unit_id == unit.id, Category.name == body.name.strip())):
        raise HTTPException(400, f"{unit.name} already has a category with this name")
    if db.scalar(select(Category).where(Category.code == code)):
        raise HTTPException(400, "This category code is already used")
    count = len(db.scalars(select(Category.id).where(Category.unit_id == unit.id)).all())
    cat = Category(unit_id=unit.id, name=body.name.strip(), code=code, description=body.description, color=body.color,
                   source_name=body.name.strip(), sort_order=count)
    db.add(cat)
    db.commit()
    return category_out(cat)


@router.put("/{cat_id}", dependencies=[Depends(admin_only)])
def update_category(cat_id: int, body: CategoryIn, db: Session = Depends(get_db)):
    cat = db.get(Category, cat_id) or _404()
    if db.scalar(select(Category).where(Category.unit_id == cat.unit_id, Category.name == body.name.strip(),
                                        Category.id != cat.id)):
        raise HTTPException(400, "This unit already has a category with this name")
    cat.name, cat.description, cat.color = body.name.strip(), body.description, body.color
    db.commit()
    return category_out(cat)


@router.delete("/{cat_id}", dependencies=[Depends(admin_only)])
def delete_category(cat_id: int, db: Session = Depends(get_db)):
    cat = db.get(Category, cat_id) or _404()
    if cat.folders:
        raise HTTPException(400, "Move or delete the folders in this category first")
    db.delete(cat)
    db.commit()
    return {"ok": True}


def _404():
    raise HTTPException(404, "Category not found")

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Unit
from ..security import admin_only, current_user
from ..serializers import unit_out

router = APIRouter(prefix="/api/units", tags=["units"], dependencies=[Depends(current_user)])


class UnitIn(BaseModel):
    name: str
    code: str = ""
    description: str = ""
    color: str = "#1d5fd6"


@router.get("")
def list_units(db: Session = Depends(get_db)):
    return [unit_out(u) for u in db.scalars(select(Unit).order_by(Unit.sort_order, Unit.id))]


@router.post("", dependencies=[Depends(admin_only)])
def create_unit(body: UnitIn, db: Session = Depends(get_db)):
    name = body.name.strip()
    count = db.scalar(select(func.count(Unit.id))) or 0
    code = (body.code.strip().upper() or f"U{count + 1}")[:10]
    if db.scalar(select(Unit).where((func.lower(Unit.name) == name.lower()) | (Unit.code == code))):
        raise HTTPException(400, "A unit with this name or code already exists")
    unit = Unit(name=name, code=code, item_prefix=f"{code}-", description=body.description, color=body.color,
                sort_order=count)
    db.add(unit)
    db.commit()
    return unit_out(unit)


@router.put("/{unit_id}", dependencies=[Depends(admin_only)])
def update_unit(unit_id: int, body: UnitIn, db: Session = Depends(get_db)):
    unit = db.get(Unit, unit_id) or _404()
    name = body.name.strip()
    if db.scalar(select(Unit).where(func.lower(Unit.name) == name.lower(), Unit.id != unit_id)):
        raise HTTPException(400, "A unit with this name already exists")
    unit.name, unit.description, unit.color = name, body.description, body.color
    db.commit()
    return unit_out(unit)


@router.delete("/{unit_id}", dependencies=[Depends(admin_only)])
def delete_unit(unit_id: int, db: Session = Depends(get_db)):
    unit = db.get(Unit, unit_id) or _404()
    if unit.categories:
        raise HTTPException(400, "Delete or move this unit's categories first")
    db.delete(unit)
    db.commit()
    return {"ok": True}


def _404():
    raise HTTPException(404, "Unit not found")

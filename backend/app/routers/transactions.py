from datetime import date
from datetime import date as Date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Category, Folder, Transaction, User
from ..security import can_edit, current_user
from ..serializers import folder_out, transaction_out
from .folders import get_folder

router = APIRouter(prefix="/api/transactions", tags=["transactions"], dependencies=[Depends(current_user)])


class IssueIn(BaseModel):
    folder_id: int
    quantity: int = Field(gt=0)
    to_from: str = Field(min_length=1)
    line_machine: str = ""
    receiver: str = ""
    date: Date | None = None
    remarks: str = ""


class ReturnIn(IssueIn):
    condition: str = "good"  # good | damaged


class StockIn(BaseModel):
    folder_id: int
    action: str  # add | damage | repair | write_off
    quantity: int = Field(gt=0)
    date: Date | None = None
    remarks: str = ""


def outstanding_on_line(db: Session, folder_id: int, line: str) -> int:
    rows = db.execute(select(Transaction.type, func.sum(Transaction.quantity))
                      .where(Transaction.folder_id == folder_id, Transaction.to_from == line,
                             Transaction.type.in_(["issue", "return"]))
                      .group_by(Transaction.type)).all()
    sums = dict(rows)
    return (sums.get("issue") or 0) - (sums.get("return") or 0)


def _record(db: Session, folder: Folder, user: User, **fields) -> dict:
    t = Transaction(folder_id=folder.id, user_id=user.id, **fields)
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"transaction": transaction_out(t), "folder": folder_out(folder)}


@router.post("/issue")
def issue(body: IssueIn, user: User = Depends(can_edit), db: Session = Depends(get_db)):
    folder = get_folder(db, body.folder_id)
    inv = folder.inventory
    if body.quantity > inv.available_qty:
        raise HTTPException(400, f"Only {inv.available_qty} available in stock")
    inv.available_qty -= body.quantity
    inv.issued_qty += body.quantity
    return _record(db, folder, user, type="issue", quantity=body.quantity, to_from=body.to_from.strip(),
                   line_machine=body.line_machine, receiver=body.receiver, date=body.date or date.today(),
                   remarks=body.remarks)


@router.post("/return")
def return_folder(body: ReturnIn, user: User = Depends(can_edit), db: Session = Depends(get_db)):
    folder = get_folder(db, body.folder_id)
    inv = folder.inventory
    line = body.to_from.strip()
    outstanding = outstanding_on_line(db, folder.id, line)
    if body.quantity > outstanding:
        raise HTTPException(400, f"Only {outstanding} of this folder is out on {line}")
    if body.quantity > inv.issued_qty:
        raise HTTPException(400, f"Only {inv.issued_qty} issued in total")
    inv.issued_qty -= body.quantity
    if body.condition == "damaged":
        inv.damaged_qty += body.quantity
    else:
        inv.available_qty += body.quantity
    return _record(db, folder, user, type="return", quantity=body.quantity, to_from=line,
                   line_machine=body.line_machine, receiver=body.receiver, condition=body.condition,
                   date=body.date or date.today(), remarks=body.remarks)


@router.post("/stock")
def stock_action(body: StockIn, user: User = Depends(can_edit), db: Session = Depends(get_db)):
    folder = get_folder(db, body.folder_id)
    inv, q = folder.inventory, body.quantity
    if body.action == "add":
        inv.total_qty += q
        inv.available_qty += q
    elif body.action == "damage":
        if q > inv.available_qty:
            raise HTTPException(400, f"Only {inv.available_qty} available to mark as damaged")
        inv.available_qty -= q
        inv.damaged_qty += q
    elif body.action == "repair":
        if q > inv.damaged_qty:
            raise HTTPException(400, f"Only {inv.damaged_qty} marked as damaged")
        inv.damaged_qty -= q
        inv.available_qty += q
    elif body.action == "write_off":
        if q > inv.damaged_qty:
            raise HTTPException(400, f"Only {inv.damaged_qty} damaged items can be written off")
        inv.damaged_qty -= q
        inv.total_qty -= q
    else:
        raise HTTPException(400, "Unknown stock action")
    return _record(db, folder, user, type=body.action, quantity=q, date=body.date or date.today(), remarks=body.remarks)


@router.get("")
def list_transactions(type: str = "", folder_id: int | None = None, line: str = "", search: str = "",
                      date_from: date | None = None, date_to: date | None = None, unit_id: int | None = None,
                      page: int = 1, page_size: int = 25, db: Session = Depends(get_db)):
    q = select(Transaction).join(Folder).join(Category)
    if unit_id:
        q = q.where(Category.unit_id == unit_id)
    if type:
        q = q.where(Transaction.type.in_(type.split(",")))
    if folder_id:
        q = q.where(Transaction.folder_id == folder_id)
    if line:
        q = q.where(Transaction.to_from == line)
    if date_from:
        q = q.where(Transaction.date >= date_from)
    if date_to:
        q = q.where(Transaction.date <= date_to)
    for term in search.lower().split():
        like = f"%{term}%"
        q = q.where(or_(func.lower(Folder.name).like(like), func.lower(Folder.item_code).like(like),
                        func.lower(Transaction.to_from).like(like), func.lower(Transaction.remarks).like(like),
                        func.lower(Transaction.receiver).like(like)))
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    page_size = max(1, min(page_size, 500))
    rows = db.scalars(q.order_by(Transaction.date.desc(), Transaction.id.desc())
                      .offset((max(page, 1) - 1) * page_size).limit(page_size))
    return {"total": total, "page": page, "page_size": page_size, "items": [transaction_out(t) for t in rows]}


@router.get("/lines/outstanding")
def all_outstanding(unit_id: int | None = None, db: Session = Depends(get_db)):
    """Everything currently out on lines, grouped by folder+line (feeds the Return form)."""
    q = select(Transaction.folder_id, Transaction.to_from, Transaction.type, func.sum(Transaction.quantity))
    if unit_id:
        q = q.join(Folder, Transaction.folder_id == Folder.id).join(Category).where(Category.unit_id == unit_id)
    rows = db.execute(q.where(Transaction.type.in_(["issue", "return"]))
                      .group_by(Transaction.folder_id, Transaction.to_from, Transaction.type)).all()
    acc: dict[tuple[int, str], int] = {}
    for fid, line, ttype, qty in rows:
        acc[(fid, line)] = acc.get((fid, line), 0) + (qty if ttype == "issue" else -qty)
    folders = {f.id: f for f in db.scalars(select(Folder).where(Folder.id.in_({k[0] for k in acc})))}
    return [{"folder_id": fid, "folder_name": folders[fid].name, "item_code": folders[fid].item_code,
             "unit": folders[fid].category.unit.name if folders[fid].category.unit else "",
             "line": line, "qty": qty}
            for (fid, line), qty in sorted(acc.items(), key=lambda kv: (kv[0][1], kv[0][0])) if qty > 0]

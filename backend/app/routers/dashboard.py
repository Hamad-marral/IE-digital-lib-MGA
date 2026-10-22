from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, true
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Category, Folder, Transaction, Unit
from ..security import current_user
from ..serializers import folder_out, stock_status, transaction_out, unit_out

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(current_user)])


@router.get("")
def dashboard(unit_id: int | None = None, db: Session = Depends(get_db)):
    in_unit = (Category.unit_id == unit_id) if unit_id else true()
    folders = db.scalars(select(Folder).join(Category).where(in_unit)).all()
    invs = [f.inventory for f in folders]
    today = date.today()
    month_start = today.replace(day=1)

    def tx_query(*cols):
        return select(*cols).join(Folder, Transaction.folder_id == Folder.id).join(Category).where(in_unit)

    def month_sum(ttype: str) -> int:
        return db.scalar(tx_query(func.coalesce(func.sum(Transaction.quantity), 0))
                         .where(Transaction.type == ttype, Transaction.date >= month_start)) or 0

    categories = []
    for c in db.scalars(select(Category).outerjoin(Unit).where(in_unit)
                        .order_by(Unit.sort_order, Category.sort_order, Category.id)):
        cinv = [f.inventory for f in c.folders]
        categories.append({"id": c.id, "name": c.name, "color": c.color, "types": len(c.folders),
                           "unit": c.unit.name if c.unit else "",
                           "qty": sum(i.total_qty for i in cinv), "available": sum(i.available_qty for i in cinv)})

    start = today - timedelta(days=13)
    daily = {start + timedelta(days=i): {"issue": 0, "return": 0} for i in range(14)}
    for d, ttype, qty in db.execute(tx_query(Transaction.date, Transaction.type, func.sum(Transaction.quantity))
                                    .where(Transaction.date >= start, Transaction.type.in_(["issue", "return"]))
                                    .group_by(Transaction.date, Transaction.type)):
        if d in daily:
            daily[d][ttype] = qty

    low = sorted((f for f in folders if stock_status(f.inventory) != "available"),
                 key=lambda f: (f.inventory.available_qty, f.name))
    recent = db.scalars(tx_query(Transaction).order_by(Transaction.created_at.desc(), Transaction.id.desc()).limit(8))

    return {
        "totals": {
            "folder_types": len(folders),
            "total_qty": sum(i.total_qty for i in invs),
            "available": sum(i.available_qty for i in invs),
            "issued": sum(i.issued_qty for i in invs),
            "damaged": sum(i.damaged_qty for i in invs),
            "low_stock": sum(1 for i in invs if stock_status(i) == "low_stock"),
            "out_of_stock": sum(1 for i in invs if stock_status(i) == "out_of_stock"),
            "categories": len(categories),
            "issued_this_month": month_sum("issue"),
            "returned_this_month": month_sum("return"),
        },
        "by_category": categories,
        "units": [unit_out(u) for u in db.scalars(select(Unit).order_by(Unit.sort_order, Unit.id))],
        "trend": [{"date": d.isoformat(), **v} for d, v in daily.items()],
        "low_stock": [folder_out(f) for f in low[:8]],
        "recent": [transaction_out(t) for t in recent],
    }

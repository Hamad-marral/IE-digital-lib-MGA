from .models import Attachment, Category, Folder, Transaction, Unit, User


def stock_status(inv) -> str:
    if inv.available_qty <= 0:
        return "out_of_stock"
    if inv.available_qty <= inv.min_qty:
        return "low_stock"
    return "available"


def unit_ref(u: Unit | None) -> dict | None:
    return {"id": u.id, "name": u.name, "code": u.code, "color": u.color} if u else None


def unit_out(u: Unit) -> dict:
    invs = [f.inventory for c in u.categories for f in c.folders if f.inventory]
    return {
        **unit_ref(u), "description": u.description, "item_prefix": u.item_prefix, "sort_order": u.sort_order,
        "category_count": len(u.categories), "folder_count": len(invs),
        "total_qty": sum(i.total_qty for i in invs), "available_qty": sum(i.available_qty for i in invs),
        "issued_qty": sum(i.issued_qty for i in invs), "damaged_qty": sum(i.damaged_qty for i in invs),
        "alerts": sum(1 for i in invs if stock_status(i) != "available"),
    }


def category_out(c: Category) -> dict:
    invs = [f.inventory for f in c.folders if f.inventory]
    return {
        "id": c.id, "name": c.name, "code": c.code, "description": c.description, "color": c.color,
        "unit_id": c.unit_id, "unit": unit_ref(c.unit),
        "sort_order": c.sort_order, "folder_count": len(c.folders),
        "total_qty": sum(i.total_qty for i in invs), "available_qty": sum(i.available_qty for i in invs),
    }


def attachment_out(a: Attachment) -> dict:
    return {"id": a.id, "kind": a.kind, "filename": a.filename, "url": a.url,
            "uploaded_at": a.uploaded_at.isoformat() if a.uploaded_at else None}


def folder_out(f: Folder, detail: bool = False) -> dict:
    inv = f.inventory
    data = {
        "id": f.id, "name": f.name, "description": f.description, "size": f.size, "variant": f.variant,
        "type": f.type, "item_code": f.item_code, "sr_no": f.sr_no, "image_url": f.image_url,
        "material": f.material, "usage": f.usage, "specs": f.specs,
        "category": {"id": f.category.id, "name": f.category.name, "code": f.category.code, "color": f.category.color,
                     "unit_id": f.category.unit_id},
        "unit": unit_ref(f.category.unit),
        "total_qty": inv.total_qty, "available_qty": inv.available_qty, "issued_qty": inv.issued_qty,
        "damaged_qty": inv.damaged_qty, "min_qty": inv.min_qty, "location": inv.location,
        "status": stock_status(inv),
        "updated_at": (inv.updated_at or f.updated_at).isoformat() if (inv.updated_at or f.updated_at) else None,
    }
    if detail:
        data["attachments"] = [attachment_out(a) for a in f.attachments]
        data["created_at"] = f.created_at.isoformat() if f.created_at else None
    return data


def transaction_out(t: Transaction) -> dict:
    return {
        "id": t.id, "type": t.type, "quantity": t.quantity, "to_from": t.to_from, "line_machine": t.line_machine,
        "receiver": t.receiver, "condition": t.condition, "date": t.date.isoformat(), "remarks": t.remarks,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "folder": {"id": t.folder.id, "name": t.folder.name, "item_code": t.folder.item_code,
                   "size": t.folder.size, "category": t.folder.category.name, "color": t.folder.category.color,
                   "unit": unit_ref(t.folder.category.unit)},
        "user": t.user.name if t.user else None,
    }


def user_out(u: User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role, "department": u.department,
            "active": u.active, "created_at": u.created_at.isoformat() if u.created_at else None}

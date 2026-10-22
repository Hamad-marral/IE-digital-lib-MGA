"""Small in-place schema upgrades for databases created by older versions (no Alembic needed)."""
import json

from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from .models import Category, Setting, Unit

DEFAULT_UNITS = [
    dict(name="Unit 1", code="U1", item_prefix="", color="#1d5fd6", sort_order=0,
         description="Unit 1 folder library (Folders Detail sheet)."),
    dict(name="Unit 2", code="U2", item_prefix="U2-", color="#ea580c", sort_order=1,
         description="Unit 2 folders, conversion kits and gauge sets."),
]


def add_category_units(engine) -> None:
    """Categories gained a unit_id and their name became unique per unit instead of globally."""
    cols = {c["name"] for c in inspect(engine).get_columns("categories")}
    if "unit_id" in cols:
        return
    with engine.begin() as conn:
        if engine.dialect.name == "sqlite":
            # SQLite cannot drop the old UNIQUE(name), so rebuild the table (ids are kept, so folders still match).
            conn.exec_driver_sql("PRAGMA foreign_keys=OFF")
            conn.exec_driver_sql("""
                CREATE TABLE categories_new (
                    id INTEGER NOT NULL PRIMARY KEY,
                    unit_id INTEGER REFERENCES units (id),
                    name VARCHAR(120) NOT NULL,
                    code VARCHAR(10) NOT NULL UNIQUE,
                    description TEXT NOT NULL,
                    color VARCHAR(16) NOT NULL,
                    source_name VARCHAR(120) NOT NULL,
                    sort_order INTEGER NOT NULL,
                    CONSTRAINT uq_category_unit_name UNIQUE (unit_id, name)
                )""")
            conn.exec_driver_sql("""
                INSERT INTO categories_new (id, name, code, description, color, source_name, sort_order)
                SELECT id, name, code, description, color, source_name, sort_order FROM categories""")
            conn.exec_driver_sql("DROP TABLE categories")
            conn.exec_driver_sql("ALTER TABLE categories_new RENAME TO categories")
        else:
            conn.execute(text("ALTER TABLE categories ADD COLUMN unit_id INTEGER REFERENCES units (id)"))
            conn.execute(text("ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key"))
            conn.execute(text("ALTER TABLE categories ADD CONSTRAINT uq_category_unit_name UNIQUE (unit_id, name)"))
    print("[migrate] categories: added unit_id")


def ensure_units(db: Session) -> list[Unit]:
    if not db.scalar(select(Unit).limit(1)):
        for u in DEFAULT_UNITS:
            db.add(Unit(**u))
        db.flush()
    units = db.scalars(select(Unit).order_by(Unit.sort_order, Unit.id)).all()
    # Anything created before units existed belongs to the first unit.
    for cat in db.scalars(select(Category).where(Category.unit_id.is_(None))):
        cat.unit_id = units[0].id
    db.commit()
    return units


def seeded_units(db: Session) -> set[str]:
    row = db.get(Setting, "seeded_units")
    return set(json.loads(row.value)) if row else set()


def mark_seeded(db: Session, codes: set[str]) -> None:
    row = db.get(Setting, "seeded_units") or Setting(key="seeded_units")
    row.value = json.dumps(sorted(codes))
    db.merge(row)
    db.commit()

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Unit(Base):
    """A production unit (e.g. Unit 1, Unit 2). Each unit keeps its own categories and stock."""
    __tablename__ = "units"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), unique=True)
    code: Mapped[str] = mapped_column(String(10), unique=True)  # U1, U2 ...
    item_prefix: Mapped[str] = mapped_column(String(10), default="")  # prepended to item codes, e.g. "U2-"
    description: Mapped[str] = mapped_column(Text, default="")
    color: Mapped[str] = mapped_column(String(16), default="#1d5fd6")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    categories: Mapped[list["Category"]] = relationship(back_populates="unit")


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("unit_id", "name", name="uq_category_unit_name"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    unit_id: Mapped[int | None] = mapped_column(ForeignKey("units.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(120))
    code: Mapped[str] = mapped_column(String(10), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    color: Mapped[str] = mapped_column(String(16), default="#2563eb")
    source_name: Mapped[str] = mapped_column(String(120), default="")  # header text in the Excel sheet
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    unit: Mapped[Unit | None] = relationship(back_populates="categories")
    folders: Mapped[list["Folder"]] = relationship(back_populates="category")


class Folder(Base):
    __tablename__ = "folders"
    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")  # original Excel description
    size: Mapped[str] = mapped_column(String(40), default="")
    variant: Mapped[str] = mapped_column(String(20), default="")
    type: Mapped[str] = mapped_column(String(60), default="")
    item_code: Mapped[str] = mapped_column(String(20), unique=True)
    sr_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_url: Mapped[str] = mapped_column(String(300), default="")
    material: Mapped[str] = mapped_column(String(120), default="")
    usage: Mapped[str] = mapped_column(Text, default="")
    specs: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    category: Mapped[Category] = relationship(back_populates="folders")
    inventory: Mapped["Inventory"] = relationship(back_populates="folder", uselist=False, cascade="all, delete-orphan")
    attachments: Mapped[list["Attachment"]] = relationship(back_populates="folder", cascade="all, delete-orphan")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="folder", cascade="all, delete-orphan")


class Inventory(Base):
    __tablename__ = "inventory"
    id: Mapped[int] = mapped_column(primary_key=True)
    folder_id: Mapped[int] = mapped_column(ForeignKey("folders.id"), unique=True)
    total_qty: Mapped[int] = mapped_column(Integer, default=0)
    available_qty: Mapped[int] = mapped_column(Integer, default=0)
    issued_qty: Mapped[int] = mapped_column(Integer, default=0)
    damaged_qty: Mapped[int] = mapped_column(Integer, default=0)
    min_qty: Mapped[int] = mapped_column(Integer, default=1)
    location: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    folder: Mapped[Folder] = relationship(back_populates="inventory")


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    folder_id: Mapped[int] = mapped_column(ForeignKey("folders.id"))
    # issue | return | damage | repair | write_off | add | adjust | import
    type: Mapped[str] = mapped_column(String(20))
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    to_from: Mapped[str] = mapped_column(String(120), default="")  # line
    line_machine: Mapped[str] = mapped_column(String(120), default="")
    receiver: Mapped[str] = mapped_column(String(120), default="")
    condition: Mapped[str] = mapped_column(String(20), default="")
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    date: Mapped[date] = mapped_column(Date)
    remarks: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    folder: Mapped[Folder] = relationship(back_populates="transactions")
    user: Mapped["User | None"] = relationship()


class Attachment(Base):
    __tablename__ = "attachments"
    id: Mapped[int] = mapped_column(primary_key=True)
    folder_id: Mapped[int] = mapped_column(ForeignKey("folders.id"))
    kind: Mapped[str] = mapped_column(String(20))  # image | document
    filename: Mapped[str] = mapped_column(String(255))
    url: Mapped[str] = mapped_column(String(300))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    folder: Mapped[Folder] = relationship(back_populates="attachments")


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160), unique=True)
    role: Mapped[str] = mapped_column(String(20), default="viewer")  # admin | ie_team | viewer
    department: Mapped[str] = mapped_column(String(120), default="Industrial Engineering")
    password_hash: Mapped[str] = mapped_column(String(255))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class Session(Base):
    __tablename__ = "sessions"
    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    user: Mapped[User] = relationship()


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")

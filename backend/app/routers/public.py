"""Unauthenticated, read-only endpoints used by QR code scans on the shop floor."""
import ipaddress
import re
import socket
import subprocess
import sys

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Folder, Transaction
from ..serializers import stock_status

router = APIRouter(prefix="/api/public", tags=["public"])


def lan_ips() -> list[str]:
    """This PC's private IPv4 addresses, the default-route one first (so phones on Wi-Fi can reach it)."""
    ips: list[str] = []
    try:  # no packet is sent; this just asks the OS which interface would be used
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ips.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.append(info[4][0])
    except OSError:
        pass
    if sys.platform == "win32":  # hostname lookup can miss adapters (e.g. Wi-Fi); ipconfig lists them all
        try:
            out = subprocess.run(["ipconfig"], capture_output=True, text=True, timeout=5,
                                 creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0)).stdout
            ips += re.findall(r"IPv4[^:]*:\s*([\d.]+)", out)
        except (OSError, subprocess.SubprocessError):
            pass
    out = []
    for ip in ips:
        addr = ipaddress.ip_address(ip)
        if addr.is_private and not addr.is_loopback and not addr.is_link_local and ip not in out:
            out.append(ip)
    # 172.16/12 is usually a WSL/Hyper-V/Docker virtual adapter; phones can't reach it, so list it last.
    return sorted(out, key=lambda ip: (ip.startswith("172."), out.index(ip)))


@router.get("/server-info")
def server_info(request: Request):
    port = request.url.port or (443 if request.url.scheme == "https" else 80)
    default_port = (request.url.scheme == "http" and port == 80) or (request.url.scheme == "https" and port == 443)
    suffix = "" if default_port else f":{port}"
    return {
        "hostname": socket.gethostname(),
        "lan_urls": [f"{request.url.scheme}://{ip}{suffix}" for ip in lan_ips()],
        "hostname_url": f"{request.url.scheme}://{socket.gethostname()}{suffix}",
    }


@router.get("/folders/{item_code}")
def scan_folder(item_code: str, db: Session = Depends(get_db)):
    folder = db.scalar(select(Folder).where(func.upper(Folder.item_code) == item_code.strip().upper()))
    if not folder:
        raise HTTPException(404, "No folder with this code")
    inv = folder.inventory
    rows = db.execute(select(Transaction.to_from, Transaction.type, func.sum(Transaction.quantity))
                      .where(Transaction.folder_id == folder.id, Transaction.type.in_(["issue", "return"]))
                      .group_by(Transaction.to_from, Transaction.type)).all()
    lines: dict[str, int] = {}
    for line, ttype, qty in rows:
        lines[line] = lines.get(line, 0) + (qty if ttype == "issue" else -qty)
    return {
        "id": folder.id, "item_code": folder.item_code, "name": folder.name, "type": folder.type,
        "size": folder.size, "variant": folder.variant, "material": folder.material, "usage": folder.usage,
        "specs": folder.specs, "image_url": folder.image_url,
        "images": [a.url for a in folder.attachments if a.kind == "image"],
        "category": {"name": folder.category.name, "color": folder.category.color},
        "unit": {"name": folder.category.unit.name, "color": folder.category.unit.color} if folder.category.unit else None,
        "total_qty": inv.total_qty, "available_qty": inv.available_qty, "issued_qty": inv.issued_qty,
        "damaged_qty": inv.damaged_qty, "min_qty": inv.min_qty, "location": inv.location,
        "status": stock_status(inv),
        "on_lines": [{"line": k, "qty": v} for k, v in sorted(lines.items()) if v > 0],
    }

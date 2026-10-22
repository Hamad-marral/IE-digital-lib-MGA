# Folder and Gauge Set Library

Folder library and inventory system for the Industrial Engineering department. Use it to browse every
IE folder, track stock, issue and return folders to sewing lines, print QR labels, and export reports to Excel.

## Run it

**Double-click `start.bat`** and open <http://localhost:8000>.

- First sign-in: `admin@ie.local` / `admin123`. Change this password in **Settings** straight away.
- Data is kept **per unit**. On first start **Unit 1** is seeded from `Folder Data/Folders Detail.xlsx` (4 categories, 40 types, 197 pcs) and **Unit 2** from `Folder Data/Folder  Guage set unit 2.xlsx` (9 categories, 80 types, 708 pcs). Unit 2 item codes start with `U2-` (e.g. `U2-KS-001`).
- Use the **unit switcher in the top bar** (All units / Unit 1 / Unit 2) to choose which unit every page shows.
- Other PCs and phones on the same network can open `http://<this-pc-name>:8000`. The QR codes link to this address.

For development, run `dev.bat`. It starts the API with auto-reload on :8000 and the Vite dev UI on <http://localhost:5173>.

Requirements: Python 3.10+ and Node 18+.

## Features

| Area | What it does |
|---|---|
| Dashboard | KPIs, inventory by category, items by status, 14-day issue/return trend, recent activity, low-stock alerts |
| Digital Library | Category tabs, search, type/status filters, grid or list view, an illustration for each folder type |
| Item detail | Stock tiles, specs, photo gallery and upload, documents/drawings, full history, QR code (PNG or print) |
| Inventory | Sortable table, issue/return/adjust from each row (add stock, mark damaged, repair, write off), Excel export |
| Issue / Return | Issue to a line, return from a line with a Good/Damaged condition, live view of what is out on each line |
| Transactions | Full audit trail with filters, date range and Excel export |
| Reports | Stock by category, monthly issued vs returned, usage by line, most-issued folders, low-stock list, 3 Excel exports |
| QR Labels | Printable label sheet for all folders, a category, or a single folder |
| Users | Roles: **Admin** (everything), **IE Team** (issue, return, edit), **Read-only** |
| Settings | Excel re-import with preview, production lines, minimum stock rule, categories, password |

### Stock rules
`total = available + issued + damaged`. A return can never be larger than what is actually out on that line.
A folder is **Low Stock** when available ≤ its minimum, and **Out of Stock** when available is 0.

### Excel import
**Settings → Import from Excel**: first pick the unit, then the file. Two layouts are read automatically:
the Unit 1 layout (a category title, then a `SR# | Description | Qty` header, then rows) and the Unit 2 layout
(a category title, then size rows with Single Part / 2 Part / conversion kit / gauge set quantities; `nil` = none).
Matching items in that unit (same category and description) have their total synced to the sheet; new rows get the
next item code (e.g. `WB-028`, `U2-KS-035`). Other units are never touched.

## Structure

```
backend/   FastAPI + SQLAlchemy  (app/main.py, models.py, importer.py, routers/*)
frontend/  React + Vite          (src/pages/*, src/components/*, src/styles.css)
backend/data/   SQLite database + uploaded photos/documents (back this folder up)
```

API docs: <http://localhost:8000/docs>

### Using PostgreSQL
Run `pip install "psycopg[binary]"`, then set
`DATABASE_URL=postgresql+psycopg://user:pass@host/ie_library` before starting the app. Tables are created automatically.

To start again from the Excel file, stop the server, delete `backend/data/ie_library.db`, and start it again.




cd "D:\IE Digital Lib\backend"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

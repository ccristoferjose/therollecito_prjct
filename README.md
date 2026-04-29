# Restaurant Ordering Platform

Multi-location restaurant ordering system with online pickup ordering, real-time kitchen management, and role-based access control.

## Project Structure

```
restaurant-ordering-platform/
├── frontend/          # Client-side application (React/Next.js)
├── backend/           # Server-side application + database
│   └── database/      # MySQL schema, stored procedures, and scripts
│       ├── schema.sql              # DDL — tables, indexes, constraints
│       ├── stored_procedures.sql   # All stored procedures (secure data layer)
│       ├── reset.sql               # Drop everything (for testing)
│       ├── run.sh                  # Execute scripts against local MySQL
│       └── er-diagram.md           # Mermaid ER diagram
├── .gitignore
└── README.md
```

## Tech Stack

| Layer      | Technology                     |
|------------|--------------------------------|
| Frontend   | TBD (React / Next.js)          |
| Backend    | TBD (Node.js / Express)        |
| Database   | MySQL 8.x (3NF, stored procs)  |
| Auth       | Firebase Authentication         |
| Payments   | Stripe                         |

## Features

- Multi-location restaurant support (3+ branches)
- Online ordering (pickup only — delivery planned)
- Real-time kitchen order management (FIFO)
- Role-based access: admin, manager, client
- Guest checkout and authenticated users (Firebase UID)
- Stripe payment tracking (idempotent)
- Promotion / discount code system

## Database

The database layer enforces all business logic through **stored procedures only**. The application DB user has `EXECUTE` privileges — no direct table access.

### Setup

```bash
# Default: root@127.0.0.1:3306, database: restaurant_ordering
./backend/database/run.sh

# Full reset + rebuild
./backend/database/run.sh --reset

# Custom connection
DB_USER=myuser DB_PASS=secret DB_PORT=3307 ./backend/database/run.sh --reset
```

### Order Lifecycle

```
CREATED → PAID → PREPARING → READY → COMPLETED
```

Status transitions are enforced at the database level — no skipping or reversing.

## Getting Started

1. Start a MySQL 8.x server (local or Docker)
2. Run the database setup:
   ```bash
   ./backend/database/run.sh
   ```
3. Frontend and backend setup instructions will be added as those layers are built.

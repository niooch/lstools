# LSTools

LSTools is a logistics marketplace application for publishing transport routes, managing user verification, and communicating through a shared chat. The repository contains a Django REST API backend and a React + Vite frontend.

The product branding in the UI currently appears as `Relay Trading` / `Relay Gielda`.

## What the app does

- User registration, JWT login, email verification, and password reset
- Public user profiles plus private profile editing
- Verification document upload and review workflow
- Route marketplace with origin, destination, up to 5 intermediate stops, crew type, vehicle type, price, and status transitions
- Route photo uploads and "my routes" statistics
- Shared chat for verified users, including optional image attachments
- Localisation search backed by Nominatim
- Route length calculation backed by OSRM, with haversine fallback if OSRM is unavailable
- English and Polish UI translations

## Stack

- Backend: Django 5, Django REST Framework, SimpleJWT, drf-spectacular, django-filter, MySQL/MariaDB
- Frontend: React 19, TypeScript, Vite, React Router, Axios, i18next, Leaflet
- External services: Nominatim for geocoding, OSRM for routing/distance

## Repository layout

```text
backend/      Django project and API apps
frontend/     React/Vite single-page app
database/     SQL reference files from earlier schema/bootstrap work
req.txt       Python dependencies
instalacjaNominatim.sh  Example Nominatim container startup script
odpalenieOsrm.sh        Example OSRM container startup script
```

## Local development

### 1. Backend

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r req.txt
python backend/manage.py migrate
python backend/manage.py createsuperuser
python backend/manage.py runserver
```

Swagger UI is available at `http://127.0.0.1:8000/api/docs/`.

### 2. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local` if you want the Vite dev server to call the Django API on port 8000:

```env
VITE_API_URL=http://127.0.0.1:8000
VITE_AUTH_LOGIN=/api/auth/token/create
VITE_AUTH_REFRESH=/api/auth/token/refresh
VITE_AUTH_ME=/api/users/me
```

Then run:

```bash
npm run dev
```

### 3. External services

The transport and geocoding features depend on:

- Nominatim, configured from the `NOMINATIM_BASEURL` environment variable
- OSRM at `OSRM_BASE_URL`

The repository includes `instalacjaNominatim.sh` and `odpalenieOsrm.sh`, but both scripts contain absolute host paths and deployment-specific values. Treat them as examples and adjust them for your machine before use.

## Configuration notes

Before relying on this setup outside local development, review `backend/lstoolsApi/settings.py`. It currently contains deployment-specific hosts, mail settings, absolute filesystem paths, and database options that are not portable as-is.

Important examples:

- The database config reads credentials from a MariaDB option file at `/home/kogut/projekt/backend/lstoolsApi/mariadb.cnf`
- `NOMINATIM_BASEURL`, `OSRM_BASE_URL`, and `OSRM_CACHE_TTL_SECONDS` control geo/routing behavior
- Media uploads are stored under `backend/media/`

## Verification model

- Unauthenticated users can register, log in, verify email, and reset passwords
- Email-verified users can access chat and upload verification documents
- Fully verified users (email verified plus at least one approved verification document) can access transport tools such as routes and localisations
- Staff users bypass verification restrictions

## Main API surface

Top-level endpoints:

- `/api/docs/` and `/api/schema/` for OpenAPI docs
- `/api/auth/*` for JWT auth, email verification, and password reset
- `/api/users/*` for registration, `me`, profile editing, public profiles, and verification documents
- `/api/localisations/*` for user-created localisations
- `/api/geo/search` for Nominatim-backed place lookup
- `/api/transport/*` for vehicle types, routes, route photos, and route statistics
- `/api/chat/*` for message feed and posting

Use the Swagger page for detailed request and filter documentation. Route listing supports several search/filter parameters, including date windows, search text, and geo lookups.

## Tests and checks

Backend:

```bash
cd backend
pytest
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

## Database note

`database/schema.sql` and the other SQL files appear to be reference or legacy bootstrap artifacts. The current backend schema is represented by the Django models and migrations under `backend/`.

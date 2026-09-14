# Kerf Your Enthusiasm

> **kerf** /kərf/ *noun* — the slit made by a saw or cutting tool.

Yes, it's a pun. No, I'm not sorry.

I like to build things — apps, but also actual things. Furniture, shelves, the occasional cutting board nobody asked for. Kerf Your Enthusiasm is a woodworking toolkit that helps with the annoying math that *should* be easy for someone with an MSc in Applied Math, but gets surprisingly complicated when you grow up metric and suddenly have to deal with imperial fractions. Also, when you're moving lumber around and covered in sawdust, you start doubting your own brain. This app is that second opinion.

---

## What It Does

### Cut List Optimizer
The main thing. Tell it what sheets you have and what pieces you need — it figures out how to cut everything with the least waste.

- Tries multiple algorithms (guillotine packing, shelf packing, branch & bound) and picks the best layout
- Accounts for blade kerf and sheet padding
- Material matching: constrain parts to specific stock materials (Plywood, MDF, Baltic Birch, etc.)
- Thickness matching: parts snap to stock of the right thickness, or leave it as "any"
- Groups: bundle related parts together with a quantity multiplier (e.g. "make 4 of this cabinet carcass")
- Visual SVG layout showing every cut placement, with colour-coded parts and optional labels
- Export to PDF, CSV, or SVG to bring to the shop

### STEP File Import
For when your project started in CAD. Upload a `.step` file, pick which faces you want to cut from which bodies, and they land in your cut list as properly dimensioned parts with DXF outlines ready for a CNC router or VCarve Pro.

### Calculators
Eight shop-math tools for mid-project moments:

| Calculator | What it does |
|---|---|
| Board Feet | Volume → price estimator |
| Fraction Arithmetic | Add/subtract/multiply imperial fractions |
| Golden Ratio | Find the harmonious dimension given one side |
| Angles & Slopes | Rise/run/angle conversion |
| Shelf Spacing | Optimal shelf spacing for a given height and item count |
| Taper Jig | Calculate taper jig offset angle |
| Fraction Reference | Quick decimal ↔ fraction chart |
| Wood Movement | Seasonal expansion/contraction estimate by species |

---

## Running It Yourself

Use Node.js 20.19+ and a PostgreSQL database managed by Coolify.

```bash
git clone https://github.com/giaggiola/Kerf-Your-Enthusiasm.git
cd Kerf-Your-Enthusiasm
npm ci
cp .env.example .env.local
```

In Coolify, create a PostgreSQL database and set `DATABASE_URL` in `.env.local`.
For a dev server running directly on the same host, use a localhost port mapping
such as `127.0.0.1:55432:5432`. Keep Coolify's public database proxy disabled.
For an app container on the same Docker network, use Coolify's internal database
URL instead. Database credentials belong in environment settings, not in Git.

Set `BETTER_AUTH_SECRET` to a random secret (`openssl rand -base64 48`), then:

```bash
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The cut optimizer and
calculators use browser storage and do not require sign-in. To access the dev
server from a laptop over Tailscale, bind to the server's Tailscale IP:

```bash
npm run dev -- --hostname <server-tailscale-ip> --port 3000
```

Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the URL used in your browser.

### Database schema

The app uses PostgreSQL through Drizzle and Postgres.js. This is a fresh schema;
there is no automatic import from the previous SQLite database. Uploaded STEP
files remain on disk under `STEP_STORAGE_DIR` and need persistent storage.

After changing `src/db/schema.ts`, generate and review a migration:

```bash
npm run db:generate -- --name=describe_the_change
npm run db:migrate
npm run test:db
```

Commit the generated SQL and metadata under `src/db/migrations`. Both local
setup and container startup apply these versioned migrations. The app does not
alter its schema or seed users when a request imports the database module.
The PostgreSQL integration tests create and clean up their own test records;
CI runs them against a disposable PostgreSQL service.

### Login and local development

The landing page links to username/password login and Google sign-in. Public
signup is disabled for both methods while the open-source release is developed.
Existing accounts can sign in; usernames are stored in PostgreSQL and normalized
to lowercase by Better Auth.

For local work, set `ENABLE_DEV_LOGIN=true` in `.env.local` and run `npm run dev`.
The login page then offers **Development login**, which creates or reuses the
local `dev@localhost` account and issues a normal session cookie. The endpoint
requires a same-origin POST and is absent outside development, even if the flag
is set. The development account is also rejected by the production access gate.

For Google sign-in, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
`ALLOWED_EMAILS` in the app environment. Configure the OAuth callback in the
[Google Cloud Console](https://console.cloud.google.com/) as
`<BETTER_AUTH_URL>/api/auth/callback/google`. The public origin and callback must
match the OAuth client's authorized redirect URI.

`ALLOWED_EMAILS` is a comma-separated list of accounts permitted to access the
app. An unset list denies everyone in production; in development it permits
any authenticated account. Saved projects and STEP import
require an authenticated, permitted account. Calculators and the standalone cut
optimizer remain public.

### Sample cut lists

With `ENABLE_DEV_LOGIN=true` and the database migrated, run:

```bash
npm run db:seed:demo
```

Use **Development login** and open `/cut-list`. Four editable samples cover a
metric bookcase, a cabinet with drawers and mixed materials, a longer imperial
workshop storage list, and an empty list. Populated lists include matching sheet
stock for testing **Open layout**. Their names start with “Sample”.

The seed runs only in development and belongs to `dev@localhost`. It skips
existing sample IDs, preserving edits on rerun; deleting a sample and rerunning
the command recreates it. It never runs automatically during app startup.

### STEP/CNC backend

The STEP-to-DXF workflow requires Python 3.11+ with FastAPI, CadQuery, and
OpenCASCADE. Install the OpenGL runtime libraries required by CadQuery, then:

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
cd ..
npm run dev:all
```

The frontend runs on port 3000 and the backend on port 8001. Set
`FASTAPI_URL=http://127.0.0.1:8001` in `.env.local`. You can also run
`npm run dev` and `npm run dev:backend` separately.

## Docker and Coolify

Coolify manages PostgreSQL separately from the app and STEP backend. Set
`DATABASE_URL` to its internal URL and attach the app to the database's Docker
network. `docker-compose.yml` uses the existing `eilish_net` network by default;
set `COOLIFY_NETWORK` if your Coolify destination uses another network.

```bash
cp .env.example .env
# Fill in DATABASE_URL, auth settings, and the browser-facing URLs.
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). The entrypoint applies the
checked-in PostgreSQL migrations before starting Next.js. A failed migration
stops startup. The STEP upload volume persists separately from PostgreSQL.

For the frontend container alone:

```bash
docker build -t kerf .
docker run --network eilish_net -p 3000:3000 --env-file .env \
  -e STEP_STORAGE_DIR=/data/step-files \
  -v kerf-step-files:/data/step-files kerf
```

The production build uses a placeholder database URL and does not connect to
PostgreSQL. Runtime migrations and requests use the injected `DATABASE_URL`.

---

## Cut-list workspace

Open `/cut-list` to create or reopen a list. `/cut-list/new` supports a browser
draft before login. Add manual parts or use **Import 3D** to review STEP bodies;
confirmed bodies return to the same Parts table. **Open layout** continues into
the existing stock, nesting, and export workspace.

Edit names, quantities, dimensions, and materials directly in the table. Tab
moves between cells; Enter finishes a cell and Escape restores its previous
value. The **+ Add part** row opens a blank row; Enter or **Add** inserts it.
Use the row's **···** action for assembly groups and CAD source details. Imported
dimensions remain read-only. **Save** persists the list, and invalid fields
must be corrected or reverted before saving or opening another workspace.

The new feature lives in `src/features/cut-lists`, with separate domain,
persistence, and component modules. Dimensions are millimetres inside this
feature; its adapters preserve existing project storage units. Switching the
unit display does not rescale the underlying parts. Imported dimensions remain
linked to the selected CAD face.

The existing layout canvas works in inches internally. Its persistence adapters
convert dimensions, kerf, padding, and saved positions to and from the project's
storage units. Display units are a browser preference; they never relabel stored
numbers. Project bundles identify the unit used by their numeric payload.

Save writes parts in a PostgreSQL transaction and rejects an outdated revision.
Drafts stay in browser storage across navigation and reloads. On a conflict,
download the draft before loading the newer saved version. A changed parts list
invalidates the existing layout. Grain constraints, the stock editor redesign,
and ordered saw operations are subsequent slices described in
[the workflow recommendation](docs/cut-list-flow-recommendation.md).

Run `npm run test:parts` for dimension conversion, identity, and validation
regressions. `npm test` runs these along with the existing optimizer tests.

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Database:** PostgreSQL via Drizzle ORM, managed by Coolify
- **Auth:** Better-Auth with Google OAuth
- **STEP/CAD:** FastAPI, CadQuery, ezdxf (Python)
- **Exports:** jsPDF, JSZip

---

## License

MIT — do whatever you want with it.

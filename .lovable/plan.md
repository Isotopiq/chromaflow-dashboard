
# HPLC / MS Method Development Dashboard — Phased Plan

A scientist-grade web app for planning, running, comparing, and reporting HPLC and mass-spec methods. Built UI-first with realistic mock data, then wired to a real backend (Lovable Cloud now, swappable to your own Supabase later). mzML parsing runs in the browser. Roles are baked in from day one (admin / developer / reviewer).

---

## Tech stack

- TanStack Start (React 19, file-based routes, SSR)
- Tailwind v4 + shadcn/ui (semantic tokens, dark-mode ready, lab-instrument feel)
- shadcn `Sidebar` for primary navigation, persistent across all app routes
- Plotly.js (`react-plotly.js`) for chromatograms, overlays, heatmaps, scatter
- `mzdata` / custom `pako`+`fast-xml-parser` mzML reader (client-side, Web Worker)
- Zod for all input validation
- Phase 2+: Lovable Cloud (Supabase) for auth, storage, Postgres, RLS
- Phase 3: jsPDF + html2canvas for PDF reports; PapaParse for CSV export

---

## Information architecture

```text
/                         Dashboard (overview)
/methods                  Method development log (list + filters)
/methods/$id              Method detail + annotations + run history
/methods/new              Create method
/methods/compare          Side-by-side method comparison
/columns                  Column library
/columns/$id              Column detail (usage, lifetime, performance notes)
/runs                     File upload + parsed run list
/runs/$id                 Single chromatogram viewer + peak table + annotations
/overlay                  Multi-run overlay workspace
/analytes                 Analyte comparison tool (RT, intensity, area across methods)
/batches                  Batch / experiment tracking
/reports                  Report builder + history
/login, /signup, /reset-password
/_authenticated/*         All app routes behind auth gate
/_authenticated/_admin/*  Admin-only (user management, role assignment)
```

The home dashboard surfaces: recent runs, active columns (with lifetime bars), recent chromatogram thumbnails, pinned methods, and quick actions (upload, new method).

---

## Phase 1 — Full UI shell with mock data (this turn)

Goal: every page navigable, every chart real (Plotly), realistic fixtures so you can evaluate the whole product immediately.

### 1.1 App shell & design system
- Lab-instrument visual direction: tight typography (JetBrains Mono for data, Inter for UI), high-contrast tokens, dark mode default, restrained accent color, dense data-first layouts.
- Define semantic tokens in `src/styles.css`: `--chart-trace-1..8`, `--peak-annotated`, `--peak-unannotated`, `--column-healthy/warn/expired`, `--surface-panel`, gradients for hero charts.
- Collapsible sidebar (`shadcn/ui Sidebar`, `collapsible="icon"`) with route groups: Overview, Methods, Runs, Columns, Analytes, Batches, Reports, Admin.
- Topbar: global search, upload shortcut, user menu, theme toggle.

### 1.2 Mock data layer
- `src/mocks/` with seed generators for methods, columns, runs, peaks, analytes, batches, users.
- Synthetic chromatogram generator (Gaussian peaks + baseline + noise) so overlays and comparisons look real.
- Fixtures stored in-memory via Zustand; pages read/write through typed hooks (`useMethods`, `useRuns`, …) that will swap to server functions in phase 2 with no component changes.

### 1.3 Pages built in phase 1
- **Dashboard** — KPI tiles (active methods, runs this week, columns near EOL), recent-runs table, mini chromatogram cards, column health list.
- **Methods log** — filterable table (modality, column, analyst, status), tag chips, quick-edit drawer.
- **Method detail** — parameters (mobile phases A/B, gradient table, flow, temp, injection vol, detector), MS settings (ionization, scan range, polarity), annotation timeline, linked runs.
- **New / edit method** — multi-step form with gradient editor (rows of time/%B), Zod-validated.
- **Method comparison** — pick 2 methods, side-by-side parameter diff table, overlay of representative chromatograms, computed deltas (resolution, RT drift, peak width).
- **Column library** — card grid with usage bar (injections vs. rated lifetime), pressure trend sparkline, status badge.
- **Column detail** — full usage history table, performance notes (markdown), maintenance log, attached methods.
- **Runs (upload)** — drag-and-drop zone (mzML/.raw/.mzXML accepted), per-file progress, parsed-run list.
- **Run detail** — Plotly TIC/BPC chromatogram, peak table (RT, area, height, FWHM, S/N), annotation panel (manual labels + suggested matches from a mock metabolite library), MS spectrum panel for selected peak.
- **Overlay workspace** — pick N runs, color-coded traces, normalize/align toggles, RT window zoom, export PNG.
- **Analyte comparison** — pick analytes from library, matrix view of RT / area / intensity across methods, Plotly heatmap + scatter.
- **Batches** — batch list, per-batch sample table, link to runs/methods.
- **Reports** — template picker, drag-to-include sections (method, chromatograms, peak tables, comparisons), preview pane.

### 1.4 Plotly integration
- `<ChromatogramPlot>`, `<OverlayPlot>`, `<HeatmapPlot>`, `<ScatterPlot>` wrapper components themed against semantic tokens, with shared toolbar (zoom, pan, autoscale, export PNG).
- Peak annotation overlay layer using Plotly shapes + annotations, click-to-label.

---

## Phase 2 — Real backend (after you confirm Cloud or your Supabase)

### 2.1 Enable Lovable Cloud (or connect your Supabase)
- Auth: email/password + Google.
- `user_roles` table + `app_role` enum (`admin`, `developer`, `reviewer`) with `has_role()` security-definer function.
- Route guards via `_authenticated.tsx` and `_authenticated/_admin.tsx`.

### 2.2 Schema (high level)

```text
profiles(id, display_name, org, created_at)
user_roles(user_id, role)
columns(id, name, chemistry, dimensions, particle_size, serial,
        rated_injections, installed_at, status, owner_id)
column_events(id, column_id, kind, note, pressure, created_at)
methods(id, name, modality, column_id, gradient_json, ms_params_json,
        notes_md, status, created_by, created_at, updated_at)
method_revisions(id, method_id, diff_json, author_id, created_at)
batches(id, name, project, started_at, owner_id)
runs(id, method_id, column_id, batch_id, file_path, file_format,
     acquired_at, parsed_status, summary_json, uploaded_by)
peaks(id, run_id, rt, area, height, fwhm, sn, analyte_id, confidence,
      annotated_by, annotation_source)
analytes(id, name, formula, mz, rt_expected, library_source)
annotations(id, run_id, peak_id, label, note, author_id, created_at)
reports(id, title, config_json, pdf_path, created_by, created_at)
```
RLS: row-level by owner / org; reviewers get read on shared methods/runs; admins full.

### 2.3 mzML parsing (client-side)
- Web Worker reads file via `File.stream()`, decompresses base64+zlib binary arrays, extracts MS1 TIC + per-scan m/z arrays.
- Peak picking: simple centroid + smoothed first-derivative zero-crossing; FWHM and S/N computed from local baseline.
- Worker posts a normalized `RunSummary` ({ tic[], bpc[], peaks[], metadata }) to the main thread; only the summary is persisted (file itself stored in Supabase Storage).
- `.raw` (Thermo) is **not** supported in browser — UI shows a helpful note pointing to ProteoWizard `msconvert`.

### 2.4 Server functions (TanStack `createServerFn`)
- `listMethods`, `getMethod`, `upsertMethod`, `compareMethods`
- `listColumns`, `getColumn`, `upsertColumn`, `logColumnEvent`
- `listRuns`, `getRun`, `createRunFromUpload(summary)`, `annotatePeak`
- `listBatches`, `linkRunToBatch`
- All protected by `requireSupabaseAuth`; admin-only ones gated by `has_role`.

---

## Phase 3 — Reporting, batches, exports, polish

- **PDF reports**: jsPDF + html2canvas; templates "Method Summary", "Run Report", "Method Comparison", "Batch Summary". Server function generates and stores the PDF, returns a signed URL.
- **CSV / JSON exports**: per run (peak table), per analyte comparison, per batch summary; one-click download buttons everywhere a table appears.
- **Automated annotation**: nearest-neighbor match against the analyte library by (m/z tolerance, RT window), confidence score, "accept all above X" workflow.
- **Sharing**: per-method/run share toggle (read-only link for reviewers).
- **Admin page**: user list, role assignment, column ownership transfer.
- **Notifications**: column-near-EOL toast on dashboard load, parse-failure list.

---

## Risks & notes (read this)

- Browser mzML parsing is realistic for files up to ~100–300 MB; very large MS2-heavy files may need server-side parsing later. The architecture keeps that swap clean (worker → server function with same `RunSummary` contract).
- `.raw`, `.wiff`, `.d` are vendor-locked binary formats — no pure-JS parser exists. The UI accepts them for storage/metadata but tells the user to convert to mzML for chromatogram extraction.
- This plan is large. Phase 1 alone is several hundred files of UI; expect to iterate visually after the first build before moving to phase 2.

---

## What I'll build first if you approve

Phase 1 in one pass:
1. Sidebar shell + theme tokens
2. Mock data layer + Zustand stores
3. Dashboard, Methods (list + detail + new), Columns (list + detail), Runs (upload + list + detail with Plotly), Overlay, Analyte comparison, Method comparison, Batches, Reports (preview only)
4. All routes behind a mock auth gate so the role-based shell is in place for phase 2

Then we pause, you review, and we decide whether to enable Lovable Cloud now or wait for your Supabase before phase 2.

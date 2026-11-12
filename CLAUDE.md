# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server on port 3000 (moves to the next free port if taken), bound to `0.0.0.0` (LAN-accessible).
- `npm run build` — production build to `dist/`. `dist/` is **tracked in git**, so this changes committed files.
- `npm run preview` — serve the built bundle.
- `npm run lint` — ESLint over the whole repo (`dist/` is globally ignored).
- `run-local.cmd check` — lint plus a production build to `node_modules/.clustereye-check`, leaving `dist/` untouched. Prefer this for verifying a change.

No test framework is configured, so verify behaviour in the running app. `run-local.cmd dev` prints a manual smoke test.

## Environment

Firebase config is loaded from `import.meta.env.VITE_FIREBASE_*` in `src/firebaseConfig.js`. A `.env` at the repo root with all seven `VITE_FIREBASE_*` keys (see README) is required for sign-in and data to work. `VITE_ALLOW_SIGNUP=false` hides the sign-up page and link (`SIGNUP_ENABLED` in `firebaseConfig.js`); to actually block new accounts, also turn off sign-up in Firebase Authentication.

## Scope

ClusterEye is a manually maintained inventory. It does not probe hosts, so don't present records as live health or availability, and don't describe an unrecorded IP as free.

## Architecture

### Auth-gated SPA shell
`src/App.jsx` is the only router (`HashRouter`, paired with `base: './'` in `vite.config.js` so builds work at a domain root or subpath). It subscribes to `onAuthStateChanged` once and renders **two entirely different route trees** based on `user`:
- Unauthenticated: only `/` (Login) and `/signup` exist; everything else redirects to `/`.
- Authenticated: the `.telemetry-theme` shell with `Navbar` wraps `Dashboard`, `Nodes`, `Clusters`, `Disks`, `Network`, `Docker`, `Profile`.

There is no `<ProtectedRoute>` wrapper — gating is structural. Don't add routes outside this pattern; add them inside the correct branch of `App.jsx`. Pages are `lazy()`-loaded.

### Firestore as the only data layer
Data pages use `onSnapshot` with `where("userId", "==", uid)` for real-time per-user data. There is no backend, no API layer, no Redux/Zustand — page-local `useState` holds query results. The collections are:

| Collection   | Purpose                                | Notable fields                              |
|--------------|----------------------------------------|---------------------------------------------|
| `clusters`   | Logical grouping w/ base IP + mask     | `cluster`, `ipAddress`, `subnetMask`, `color`; derived `total`, `used`, `free`, `disks`, `nodes` |
| `nodes`      | VMs / LXC containers                   | `nodeId`, `node`, `type`, `cluster`, `clusterId`, `ipAddress`, `allocations[]`, `allocated` |
| `disks`      | Physical storage pools                 | `disk`, `cluster`, `clusterId`, `total`, `used`, `free` (bytes); derived `nodes` |
| `containers` | Docker containers running on nodes     | `containerId`, `name`, `nodeId`, `nodeRefId`, `port` |
| `ipIndex`    | One claim per node IP, doc ID `{uid}_{ip}` | `userId`, `ip`, `nodeRef` |

### Security rules allowlist fields
`firestore.rules` does more than check ownership. Every document must carry a `userId` equal to `request.auth.uid`, which can't change on update. In addition, each collection has `hasOnly` / `changedOnly` field allowlists, and rules verify cluster and node ownership, disk capacity, and port range.

Rules also cap string lengths and require counts to be non-negative numbers. These limits apply only to the keys a write sets (`writtenKeys()`), so older documents that exceed them can still take unrelated updates.

**Adding a field to a document means updating the allowlists in `firestore.rules` and deploying them, or the writes are rejected.** Rules changes have no effect until deployed (see README).

Passwords are no longer stored on nodes or containers: rules only allow removing a legacy `password` field, and `Profile.jsx` has the purge action. Don't reintroduce credential fields.

### Records link by ID and copy names
Documents reference each other by ID (`clusterId`, `allocations[].diskId`, `nodeRefId`) and also store a copy of the display name (`cluster`, `allocations[].disk`, `nodeId`).
- Renames must cascade to the copies; see `ClusterModal.jsx`, `DiskModal.jsx`, `NodeModal.jsx`.
- Older documents may lack the ID, so lookups fall back to the name, e.g. `n.clusterId ? n.clusterId === cluster.id : n.cluster === cluster.cluster`. Keep this fallback when matching records.

### Multi-document writes
- **Disk usage changes use `runTransaction`.** Creating, editing, or deleting a node reads the affected disks inside the transaction, checks capacity, then updates `used` and `free` with the node. See `handleCreate` in `src/pages/Nodes.jsx` and `src/components/NodeModal.jsx`. Don't update `disks.used` outside a transaction. The `increment()` mentioned in the comment at `src/pages/Clusters.jsx:543` is no longer used.
- **`writeBatch` is for cascades and bulk changes with no capacity check**: renames, and account deletion and password purge in `Profile.jsx`, which chunk to 400 documents per batch.
- **Derived fields are written by `recomputeAndPersist` in `src/pages/Clusters.jsx`**, on a debounce while that page is open. It sets the cluster aggregates and each disk's `free` and `nodes`, and must never write `disks.used`.

Allocation sizes are stored in GB and converted with decimal units (`1 GB = 1_000_000_000` bytes), not 1024-based.

### Subnet & IP validation (`src/utils/network.js`)
`ipToLong` / `longToIp` / `isIpInSubnet` / `calculateNetworkAddress` / `isValidSubnetMask` are the canonical IP helpers. When validating a node's IP against its cluster, the mask defaults to `255.255.255.0` if `cluster.subnetMask` is missing. The Network page's IpMap renders a 16×16 matrix per `/24`.

Node IPs are unique per user, enforced by the rules through the `ipIndex` collection (`src/utils/ipIndex.js`). Each node IP has a document `ipIndex/{uid}_{ip}` holding `{ userId, ip, nodeRef }`:
- A node can only be created, or have its IP changed, when that document names it after the write.
- Claims can't be updated, and a claim can only be deleted once its node no longer holds the IP, so two saves of the same IP can't both succeed, even from two tabs.
- Any transaction that writes a node's IP must read the claim first (`assertIpFree`), then write it (`claimIp`), and release the old one (`releaseIp`).
- `syncIpIndex` runs once per visit to the Nodes page. It claims IPs for nodes saved before the index existed and removes stale claims. Older nodes that already share an IP keep showing as duplicates on the Network page.

Pages still check for duplicates across `nodes` and `clusters` before saving, so they can give a friendly message. A cluster's base IP is only checked client-side.

### Page / component split
- `src/pages/*.jsx` — one large file per route. Each owns its data subscriptions, filters, sorting, and the "Add X" modal trigger. Pages hold the ID of the open record and look it up from live data, so a modal always shows the saved values.
- `src/components/*.jsx` — "Add" and view/edit modals per entity, plus `CustomSelect`, `NumberStepper`, `FilterModal`, `Navbar`, `SidebarInsight`, `LoadingState`, `LoadError`.
- `src/components/AuthForm.jsx` — `AuthShell`, `AuthField` and `PasswordField` (show/hide toggle, Caps Lock warning) for Log In and Sign Up. Both forms use `noValidate` with inline field errors.
- `src/components/Dialog.jsx` — the shell for every modal: header, scrolling body, footer, focus handling, and a discard prompt when `dirty` is set. Use it instead of writing dialog markup.
- `src/components/ui.jsx` — shared `Field`, `FormAlert`, `SearchField`, `ToolButton`, `SortHeader`, `StatCard` (takes `loading`), `EmptyState`, `ClusterColorPicker`, and `RelatedLinks` (the Linked Records section of a view dialog).
- `src/components/useOpenParam.js` — opens the record named by `?open=<id>` once a page's data loads, then removes the parameter. Linked records point to `/nodes?open=<id>`, `/clusters?open=<id>`, `/disks?open=<id>` and `/docker?open=<id>`. The route error boundary is keyed by path, so query changes don't remount the page.
- `src/utils/format.js` — `fmtBytes`, natural-order `sortRecords` (keeps IPs in numeric order), `openOnRowClick`, `toHref`, `authErrorMessage`, and `DEFAULT_CLUSTER_COLOR` (the fallback for a cluster with no colour).

View modes use `readOnly` rather than `disabled` on inputs, `CustomSelect`, and `NumberStepper`, so values can still be selected and copied.

Icons come from `@phosphor-icons/react`.

### Styling
`DESIGN.md` is the visual system of record (with `.impeccable/design.json` as its sidecar) and `PRODUCT.md` holds product context; read both before UI work, and update `DESIGN.md` when tokens change.

Tailwind CSS v4 via the Vite plugin (`@tailwindcss/vite`) — no `tailwind.config.js`, configuration is in CSS. `src/index.css` defines the color tokens in `@theme` (`bg-surface`, `bg-raised`, `bg-field`, `border-line`, `border-field-line`, `text-accent`, `text-caution`, `text-alert`, ...) and the `.input`, `.field-label`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-danger-solid`, `.icon-btn`, and `.row-open` classes. Use these rather than hex values; cluster colors are user data and stay inline.

Keep base element styles inside `@layer base`. Unlayered rules beat every Tailwind utility, so an unlayered `font: inherit` on buttons makes `text-xs` and `font-bold` silently do nothing.

The app is dark-mode only. `Outfit` is the default font (`--font-sans`); `Roboto Mono` (`--font-mono`) is for IDs, addresses, and measurements. Labels and buttons use Title Case, with no `uppercase` styling or eyebrow labels. Entrance motion lives in `src/index.css` (`stagger-cards`, `stagger-rows`, `bar-fill`, `donut-ring`, `tile-reveal`, `cell-lit`, `shimmer`) and has a reduced-motion path; see Motion in `DESIGN.md`.

### Firestore index requirements
Listing queries combine `where("userId", ...)` with `orderBy(<name>)`, which forces composite indexes (`userId` asc + entity name asc) on `nodes`, `disks`, `clusters`, defined in `firestore.indexes.json`. If you add new sorted listings, add the index there; otherwise expect a "missing index" error link in the console on first run.

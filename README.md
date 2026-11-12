<div align="center">
  <img src="public/ClusterEye.svg" alt="ClusterEye Logo" width="200" />

  # ClusterEye
</div>


> **Cluster Inventory & Management Dashboard**

**ClusterEye** is a dashboard for recording and organizing clusters, VM/LXC nodes, disks, Docker containers, and their IP addresses. Firestore keeps the inventory in sync across sessions and devices. It's a manually maintained record: it doesn't probe hosts or report live health, and an unrecorded IP isn't assumed to be free.

---

## 🚀 Key Features

*   **Dashboard:** Totals for clusters, nodes, storage, containers, and recorded IPs, with inventory checks for disks above 85% and containers without a valid host.
*   **Asset Management:**
    *   **Nodes:** Record VM/LXC nodes, their IP addresses, and disk allocations.
    *   **Disks:** Capacity and allocation per disk, checked in a transaction so a disk can't be over-allocated.
    *   **Clusters:** Group nodes and disks under a base IP and subnet, each with its own colour.
    *   **Docker:** Record containers, their host nodes, and ports.
*   **Linked Records:** Each record's view links to its cluster, disks, nodes, or containers.
*   **Network Map:** A `/24` matrix of recorded node addresses per cluster, with duplicates flagged by name.
*   **Unique IPs:** Firestore rules reject a second node with the same IP, even when two tabs save at once.
*   **Accounts:** Email and password sign-in with password reset. Each user sees only their own data. Sign-up can be turned off for a single-user install.
*   **Responsive and Accessible:** Desktop tables and mobile cards, keyboard-friendly dialogs, and a reduced-motion mode.

## 🛠️ Tech Stack

*   **Frontend:** [React 19](https://react.dev/) with React Router (hash routing)
*   **Build Tool:** [Vite 7](https://vitejs.dev/)
*   **Styling:** [Tailwind CSS v4](https://tailwindcss.com/), with design tokens in `src/index.css`
*   **Icons:** [Phosphor Icons](https://phosphoricons.com/)
*   **Backend / DB:** [Firebase](https://firebase.google.com/) Authentication and Cloud Firestore, with no separate server
*   **Hosting:** Netlify (`netlify.toml`) or Firebase Hosting (`firebase.json`); both set security headers and asset caching

## 📦 Installation

Requires [Node.js](https://nodejs.org/) 22 or later.

1.  **Clone the repository**
    ```bash
    git clone https://github.com/NaveenAkalanka/ClusterEye.git
    cd ClusterEye
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure environment**
    Copy `.env.example` to `.env` and fill in your Firebase web app config (Firebase Console → Project settings → Your apps):
    ```env
    VITE_FIREBASE_API_KEY=your_api_key
    VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_FIREBASE_STORAGE_BUCKET=your_bucket.appspot.com
    VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    VITE_FIREBASE_APP_ID=your_app_id
    VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
    # Optional: hide sign-up on a single-user install
    VITE_ALLOW_SIGNUP=false
    ```
    `.env` is git-ignored. Analytics only runs in production builds, and only when a measurement ID is set.

4.  **Run the development server**
    ```bash
    npm run dev
    ```
    Open http://localhost:3000/. The server also listens on your local network.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Production build to `dist/` (tracked in git) |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `run-local.cmd check` | Windows: lint plus a production build that leaves `dist/` untouched |

## 🔥 Firebase Setup

### 1. Create a project
Go to the [Firebase Console](https://console.firebase.google.com/) and create a project, then add a web app to get the config values for `.env`.

### 2. Enable Authentication
1.  Go to **Build → Authentication** and click **Get Started**.
2.  Enable the **Email/Password** sign-in method.
3.  Under **Settings → Authorized domains**, add the domain you'll host on. Firebase Hosting domains are added automatically.
4.  For a single-user install, set `VITE_ALLOW_SIGNUP=false`, then also untick account creation under **Settings → User actions**. Hiding the page alone doesn't stop new accounts.

### 3. Create the Firestore database
Go to **Build → Firestore Database**, click **Create Database**, choose a location, and start in **Production mode**.

### 4. Deploy rules, indexes, and the app
Install the [Firebase CLI](https://firebase.google.com/docs/cli), then from the repo:
```bash
firebase login
firebase use --add            # pick your project
npm run build
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

*   **Rules** (`firestore.rules`): limit every user to their own documents, check field types and lengths, keep disk allocation within capacity, and reject duplicate node IPs through the `ipIndex` collection.
*   **Indexes** (`firestore.indexes.json`): the composite indexes the sorted lists need.
*   **Hosting** (`firebase.json`): serves `dist/` with security headers and long-term caching for built assets.

> **Deploy rules and hosting together.** The rules expect the current app's write format, so an older build can't add nodes under the new rules.

After deploying, open the **Nodes** page once. It records the IPs of nodes created before the duplicate guard existed. Any older nodes that already share an IP stay flagged on the Network page until you change one.

## 🗂️ Project Structure

```
src/
  App.jsx              Auth-gated routes (signed out: Log In / Sign Up; signed in: the app)
  firebaseConfig.js    Firebase setup from VITE_FIREBASE_* variables
  pages/               One file per route: Dashboard, Nodes, Clusters, Disks, Network, Docker, Profile
  components/          Dialogs, shared form controls, and the auth form
  utils/               Formatting, IP and subnet helpers, IP claim index
firestore.rules        Security rules
firestore.indexes.json Composite indexes
```

## 📄 License

This project is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)** License.

You are free to:
*   **Share** — Copy and redistribute the material in any medium or format.
*   **Adapt** — Remix, transform, and build upon the material.

**Under the following terms:**
*   **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made.
*   **NonCommercial** — You may not use the material for commercial purposes.
*   **ShareAlike** — If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original.

See [LICENSE](LICENSE) for the full text.

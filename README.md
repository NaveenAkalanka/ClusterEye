<div align="center">
  <img src="public/ClusterEye.svg" alt="ClusterEye Logo" width="200" />

  # ClusterEye
</div>


> **Cluster Inventory & Management Dashboard**

**ClusterEye** is a dashboard for recording and organizing clusters, VM/LXC nodes, disks, Docker containers, and their IP addresses. Firestore synchronizes saved inventory changes between sessions. The current version does not probe infrastructure or report live host and container health.

---

## 🚀 Key Features

*   **Synchronized Dashboard:** Counts and storage totals from inventory records update through Firebase Firestore.
*   **IP Inventory Map:** A `/24` matrix shows recorded node addresses; unrecorded cells are not verified to be available.
*   **Asset Management:**
    *   **Nodes:** Record VM/LXC addresses and disk allocations.
    *   **Disks:** Visual utilization bars and storage metrics.
    *   **Clusters:** Multi-cluster support with color-coded organization.
    *   **Docker:** Record containers, host nodes, and ports.
*   **Authentication:** Per-user data access using Firebase Auth & Security Rules. There are no application roles.
*   **Responsive Layouts:** Desktop and mobile list views with adaptive navigation.

> **Credential note:** Node and container password fields are currently stored as Firestore document data. Do not use them for production secrets until dedicated secret storage is added.

## 🛠️ Tech Stack

*   **Frontend:** [React 19](https://react.dev/)
*   **Build Tool:** [Vite](https://vitejs.dev/)
*   **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) + Custom CSS Variables
*   **Icons:** [Phosphor Icons](https://phosphoricons.com/)
*   **Backend / DB:** [Firebase Firestore](https://firebase.google.com/docs/firestore) & Auth
*   **Deployment:** Netlify / Vercel (Recommended)

## 📦 Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/NaveenAkalanka/ClusterEye.git
    cd ClusterEye
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file in the root directory and add your Firebase config:
    ```env
    VITE_FIREBASE_API_KEY=your_api_key
    VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_FIREBASE_STORAGE_BUCKET=your_bucket.appspot.com
    VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    VITE_FIREBASE_APP_ID=your_app_id
    VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```

## 🔥 Firebase Setup

To get ClusterEye running, you need to configure a Firebase project.

### 1. Create Project
Go to [Firebase Console](https://console.firebase.google.com/) and create a new project.

### 2. Enable Authentication
1.  Navigate to **Build > Authentication**.
2.  Click **Get Started**.
3.  Select **Email/Password** as a Sign-in method and **Enable** it.

### 3. Create Cloud Firestore Database
1.  Navigate to **Build > Firestore Database**.
2.  Click **Create Database**.
3.  Choose a location (e.g., `us-central1`).
4.  Start in **Production mode**.

### 4. Deploy Security Rules
Copy the content of [`firestore.rules`](firestore.rules) (included in this repo) and paste it into the **Rules** tab of your Firestore Database console.
> **Note:** These rules enforce strict data ownership. Users can only see and edit their own data.

### 5. Create Indexes (Optional)
If you encounter "Missing Index" errors in the browser console while filtering, strictly follow the link provided in the error message to automatically create the required Composite Indexes.
Common indexes needed:
*   `nodes`: `userId` (Asc) + `node` (Asc)
*   `disks`: `userId` (Asc) + `disk` (Asc)
*   `clusters`: `userId` (Asc) + `cluster` (Asc)





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



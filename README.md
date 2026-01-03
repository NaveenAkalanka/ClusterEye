# ClusterEye 👁️

> **Advanced Cluster Monitoring & Management Dashboard**

<div align="center">
  <img src="public/ClusterEye.svg" alt="ClusterEye Logo" width="200" />
</div>

**ClusterEye** is a modern, high-performance dashboard designed for visualizing and managing hybrid infrastructure. It monitoring ProxMox clusters, LXC containers, VMs, physical disks, and network topology in a single, unified interface. Built with a focus on aesthetics, strict typography, and real-time data synchronization.

---

## 🚀 Key Features

*   **Real-time Dashboard:** Live stats for Nodes, Clusters, Disks, and Docker containers synchronized via Firebase Firestore.
*   **Network Topology Map:** Visual subnet matrix (IpMap) showing active hosts and available IPs in real-time.
*   **Asset Management:**
    *   **Nodes:** Track VM/LXC resource allocation and status.
    *   **Disks:** Visual utilization bars and storage metrics.
    *   **Clusters:** Multi-cluster support with color-coded organization.
    *   **Docker:** Container monitoring with port mapping and status indicators.
*   **Secure Authentication:** Role-based access and data isolation using Firebase Auth & Security Rules.
*   **Responsive Design:** Fully optimized for Desktop, Tablet, and Mobile with adaptive layouts.

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
Copy the content of `firestore.rules` (included in this repo) and paste it into the **Rules** tab of your Firestore Database console.
> **Note:** These rules enforce strict data ownership. Users can only see and edit their own data.

### 5. Create Indexes (Optional)
If you encounter "Missing Index" errors in the browser console while filtering, strictly follow the link provided in the error message to automatically create the required Composite Indexes.
Common indexes needed:
*   `nodes`: `userId` (Asc) + `node` (Asc)
*   `disks`: `userId` (Asc) + `disk` (Asc)
*   `clusters`: `userId` (Asc) + `cluster` (Asc)

## 🔒 Security

This project implements strict **Firestore Security Rules** to ensure data integrity and isolation:
*   **Authentication Required:** Use `isOwner(userId)` checks for all read/write operations.
*   **Input Validation:** Strict type handling and regex validation for IP addresses and Node IDs.
*   **XSS Protection:** Zero usage of `dangerouslySetInnerHTML`.

## 📸 Screenshots

*(Add screenshots of your dashboard here)*

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---

Based on **Antigravity** architecture.

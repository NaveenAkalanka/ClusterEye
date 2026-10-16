# ClusterEye - Comprehensive Documentation

**Date:** 2026-01-04
**Project:** ClusterEye
**License:** CC BY-NC-SA 4.0

---

## 1. Introduction & Vision

**ClusterEye** is a dashboard for organizing records of clusters, VM/LXC nodes, Docker containers, physical storage, and IP addresses. Firestore synchronizes saved records; this version does not collect live health or availability data from infrastructure.

👉 **View Project on GitHub:** [https://github.com/NaveenAkalanka/ClusterEye](https://github.com/NaveenAkalanka/ClusterEye)

> [!INFO]
> **Vision:** "Move away from boring enterprise dashboards to a modern, 'Glassmorphism' design with strict typography."

### Why ClusterEye?
*   🌊 **Visual Network Topology:** Unlike standard lists, ClusterEye visualizes network subnets as a 16x16 matrix (IpMap).
*   ⚡ **Record Sync:** Firestore listeners update the UI when saved inventory changes. No update latency guarantee is made.
*   🎨 **Aesthetics:** Minimalist, Dark Mode-first, strict `Roboto Mono` typography.

---

## 2. Architecture & Tech Stack

The application is built as a **Single Page Application (SPA)** using modern web standards.

![React](https://img.shields.io/badge/Frontend-React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Build-Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Styling-Tailwind_CSS_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Firebase](https://img.shields.io/badge/Backend-Firebase_Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)

| Component | Technology | Reasoning |
| :--- | :--- | :--- |
| **Frontend** | React 19 + Vite | React 19 for latest hooks; Vite for instant HMR. |
| **Styling** | Tailwind CSS v4 | Rapid Utility-first CSS + Custom Tokens. |
| **Data Layer** | Firebase Firestore | NoSQL, Real-time listeners (`onSnapshot`). |
| **Auth** | Firebase Auth | Secure, off-the-shelf Email/Password auth. |

---

## 3. Key Features & Implementation

### A. The Dashboard (Bento Grid)
**Concept:** A responsive grid that auto-adjusts from 1 column (Mobile) to 6 columns (Desktop).

![Placeholder: Dashboard View](https://placehold.co/1200x600/161D22/FFF?text=Screenshot:+Dashboard+Page)
*(Insert detailed dashboard screenshot here)*

**Implementation:**
*   Uses `grid-cols-1 md:grid-cols-2 lg:grid-cols-6`.
*   **Challenge:** Mobile height for the network map was initially too small (300px).
*   **Solution:** Increased mobile minimum height to `450px`.

### B. Network Topology (IpMap)
**Concept:** A visual representation of a `/24` subnet (254 hosts).

![Placeholder: Network Map](https://placehold.co/1200x600/161D22/FFF?text=Screenshot:+Network+Map)

**Implementation:**
*   A 16x16 CSS Grid.
*   **Logic:** `ipAddress.split('.')` to determine the last octet.
*   **Visuals:** Recorded node IPs are highlighted; unrecorded addresses have not been checked for availability.

### C. Asset Management (Nodes, Disks, Clusters)
All follow a standard CRUD pattern with real-time updates.

![Placeholder: Nodes List](https://placehold.co/1200x600/161D22/FFF?text=Screenshot:+Nodes+Page)

*   **Nodes:** Track VM/LXC allocation.
*   **Disks:** Visual utilization bars.
*   **Clusters:** Color-coded grouping.

![Placeholder: Docker Containers](https://placehold.co/1200x600/161D22/FFF?text=Screenshot:+Docker+Containers)

---

## 4. Configuration & Setup

### Prerequisites
*   Node.js v18+
*   npm or yarn

### A. Environment Variables
Create a `.env` file in the root:
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
...
```

### B. Firebase Configuration
1.  **Authentication**: Enable **Email/Password** provider.
2.  **Firestore**: Create database in **Production Mode**.
3.  **Indexes**: Create composite indexes if sorting fails.

> [!TIP]
> Use the **Browser Console** logs to find direct links for creating missing Firestore indexes.

---

## 5. Development Journey: Challenges & Solutions

### 🔴 Issue 1: Infinite Loops in `useEffect`
*   **Problem:** Early versions caused infinite re-renders due to checking `currentUser` in dependencies.
*   **Solution:** Switched to `onAuthStateChanged` listener.

### 🟠 Issue 2: Mobile Responsiveness
*   **Problem:** Network Map controls overlapped on mobile.
*   **Solution:** Refactored header to `flex-col` (mobile) vs `flex-row` (desktop).

### 🟢 Issue 3: Text Standardization
*   **Problem:** Inconsistent casing (Title Case vs Sentence case).
*   **Solution:** Enforced **Title Case** and removed all `uppercase` usage for a cleaner look.

### 🔒 Issue 4: Data Security
*   **Problem:** Data isolation.
*   **Solution:** Implemented `firestore.rules` with strict `isOwner(userId)` checks.

---

## 6. Security Model

![Placeholder: Login Screen](https://placehold.co/1200x600/161D22/FFF?text=Screenshot:+Login+Page)

### Authentication
*   `App.jsx` renders authenticated and unauthenticated route trees based on Firebase Auth state.
*   Unauthenticated routes other than `/signup` redirect to `/` (the login page).

### Database Rules (`firestore.rules`)
```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }
    match /nodes/{nodeId} {
      allow create: if isOwner(request.resource.data.userId);
      allow read, delete: if isOwner(resource.data.userId);
      allow update: if isOwner(resource.data.userId) && isOwner(request.resource.data.userId);
    }
  }
}
```
> [!WARNING]
> **Policy:** Users can access only documents carrying their own `userId`. These rules do not validate field contents or encrypt stored passwords.

---

## 7. Licensing

**License:** Creative Commons Attribution-NonCommercial-ShareAlike 4.0 (CC BY-NC-SA 4.0)

![CC BY-NC-SA](https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png)

*   ❌ **Commercial Use:** Forbidden.
*   ✅ **Modifications:** Allowed (must be open-source).
*   ✅ **Attribution:** Mandatory.

---

## 8. Conclusion

ClusterEye is a usable infrastructure inventory dashboard. Live health checks, stronger data validation, and safe secret storage remain future work.

![Placeholder: Profile Page](https://placehold.co/1200x600/161D22/FFF?text=Screenshot:+Profile+Page)

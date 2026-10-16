import { Component, lazy, Suspense, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { auth } from "./firebaseConfig";
import Navbar from "./components/Navbar";
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Nodes = lazy(() => import("./pages/Nodes"));
const Clusters = lazy(() => import("./pages/Clusters"));
const Disks = lazy(() => import("./pages/Disks"));
const Network = lazy(() => import("./pages/Network"));
const Docker = lazy(() => import("./pages/Docker"));
const Profile = lazy(() => import("./pages/Profile"));

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    const isChunkError = /dynamically imported module|loading chunk|failed to fetch/i.test(this.state.error.message || "");
    return (
      <main className="min-h-screen bg-[#060906] text-white grid place-items-center p-6">
        <div role="alert" className="max-w-md rounded-2xl border border-white/10 bg-[#0D100D] p-6 text-center">
          <h1 className="text-xl font-bold mb-2">{isChunkError ? "A new version is available" : "ClusterEye could not open this page"}</h1>
          <p className="text-white/70 text-sm mb-5">{isChunkError ? "Refresh once to load the latest deployed files." : "Refresh the application and try again."}</p>
          <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-[#69639E] px-5 py-2.5 font-semibold hover:bg-[#7c75b8]">Refresh application</button>
        </div>
      </main>
    );
  }
}

function PageLoading() {
  return (
    <main className="flex-1 min-h-0 grid place-items-center text-white/60" role="status">
      Loading page...
    </main>
  );
}

function RouteErrorBoundary({ children }) {
  const location = useLocation();
  return <AppErrorBoundary key={location.key}>{children}</AppErrorBoundary>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <div className="text-white text-center mt-20">Loading...</div>;

  return (
    <Router>
      {!user ? (
        <RouteErrorBoundary>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/signup" element={<Signup />} />
              <Route path="/" element={<Login onLogin={setUser} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      ) : (
        <div className="md:h-screen flex flex-col p-4 md:p-6 gap-4 md:gap-6 md:overflow-hidden min-h-screen bg-[#060906]">
          <Navbar user={user} />
          <RouteErrorBoundary>
            <Suspense fallback={<PageLoading />}>
              <Routes>
                <Route path="/" element={<Dashboard uid={user.uid} />} />
                <Route path="/nodes" element={<Nodes uid={user.uid} />} />
                <Route path="/clusters" element={<Clusters uid={user.uid} />} />
                <Route path="/disks" element={<Disks uid={user.uid} />} />
                <Route path="/network" element={<Network uid={user.uid} />} />
                <Route path="/docker" element={<Docker user={user} />} />
                <Route path="/profile" element={<Profile user={user} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </RouteErrorBoundary>
        </div>
      )}
    </Router>
  );
}

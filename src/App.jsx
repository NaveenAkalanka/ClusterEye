import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { auth } from "./firebaseConfig";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Nodes from "./pages/Nodes";
import Clusters from "./pages/Clusters";
import Disks from "./pages/Disks";
import Network from "./pages/Network";

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
  if (!user) return <Login onLogin={setUser} />;

  return (
    <Router>
      <div className="min-h-screen bg-neutral-950 p-6">
        <Navbar user={user} />
        <Routes>
          <Route path="/" element={<Dashboard />} /> {/* Home = Dashboard */}
          <Route path="/nodes" element={<Nodes />} />
          <Route path="/clusters" element={<Clusters />} />
          <Route path="/disks" element={<Disks />} />
          <Route path="/network" element={<Network />} />
        </Routes>
      </div>
    </Router>
  );
}

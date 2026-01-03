import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { auth } from "./firebaseConfig";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Nodes from "./pages/Nodes";
import Clusters from "./pages/Clusters";
import Disks from "./pages/Disks";
import Network from "./pages/Network";
import Docker from "./pages/Docker";
import Profile from "./pages/Profile";

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
        <Routes>
          <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/" />} />
          <Route path="/" element={<Login onLogin={setUser} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <div className="md:h-screen flex flex-col p-4 md:p-6 gap-4 md:gap-6 md:overflow-hidden min-h-screen bg-[#060906]">
          <Navbar user={user} />
          <Routes>
            <Route path="/" element={<Dashboard />} /> {/* Home = Dashboard */}
            <Route path="/nodes" element={<Nodes />} />
            <Route path="/clusters" element={<Clusters />} />
            <Route path="/disks" element={<Disks />} />
            <Route path="/network" element={<Network />} />
            <Route path="/docker" element={<Docker />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      )}
    </Router>
  );
}

import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { Speedometer, HardDrives, ShareNetwork, Disc, Network, User, SignOut, ShippingContainer } from "@phosphor-icons/react"; // Importing Phosphor icons

export default function Navbar({ user }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const sidebarRef = useRef(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut(auth);
    setShowMenu(false);
  };

  const getUserInitials = user?.email?.[0]?.toUpperCase() || "U";
  const isActive = (path) => location.pathname === path;

  const handleClickOutside = (e) => {
    if (menuRef.current && !menuRef.current.contains(e.target)) {
      setShowMenu(false);
    }
    if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
      setShowSidebar(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleSidebar = () => setShowSidebar(!showSidebar);

  return (
    <>
      <div className="w-full h-20 bg-[#0D100D] rounded-[20px] relative flex items-center justify-between px-4 min-[1200px]:px-8 flex-shrink-0">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 min-[1200px]:gap-3">
          <img src="/ClusterEye.svg" alt="ClusterEye Logo" className="w-8 h-8 min-[1200px]:w-10 min-[1200px]:h-10 object-contain" />
          <div className="text-white text-lg min-[1200px]:text-2xl font-bold tracking-widest leading-none">ClusterEye</div>
        </Link>

        {/* Navigation Links (Desktop) */}
        <div className="flex items-center gap-2 text-white text-lg hidden min-[1200px]:flex">
          <NavItem label="Dashboard" to="/" icon={<Speedometer size={24} className="text-[#69639E]" />} isActive={isActive("/")} />
          <NavItem label="Nodes" to="/nodes" icon={<HardDrives size={24} className="text-[#69639E]" />} isActive={isActive("/nodes")} />
          <NavItem label="Clusters" to="/clusters" icon={<ShareNetwork size={24} className="text-[#69639E]" />} isActive={isActive("/clusters")} />
          <NavItem label="Disks" to="/disks" icon={<Disc size={24} className="text-[#69639E]" />} isActive={isActive("/disks")} />
          <NavItem label="Network" to="/network" icon={<Network size={24} className="text-[#69639E]" />} isActive={isActive("/network")} />
          <NavItem label="Docker" to="/docker" icon={<ShippingContainer size={24} className="text-[#69639E]" />} isActive={isActive("/docker")} />
        </div>

        {/* User Profile (Desktop) */}
        <div ref={menuRef} className="relative hidden min-[1200px]:flex items-center gap-3">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-10 h-10 bg-zinc-300 rounded-full flex items-center justify-center text-black text-xl font-bold hover:bg-zinc-400 transition-colors cursor-pointer"
          >
            {getUserInitials}
          </button>

          {showMenu && (
            <div className="absolute top-20 right-0 bg-[#161D22] border border-white/10 p-4 rounded-lg shadow-xl w-64 z-50">
              <button
                onClick={() => setShowProfileModal(true)}
                className="w-full text-left px-4 py-2 text-white hover:bg-white/10 rounded-lg cursor-pointer"
              >
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-red-400 hover:bg-white/10 rounded-lg cursor-pointer"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Mobile Toggle */}
        <button className="min-[1200px]:hidden text-white text-3xl cursor-pointer" onClick={toggleSidebar}>☰</button>

        {/* Profile Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="bg-stone-900 border border-white/10 p-8 rounded-2xl w-[400px]">
              <h2 className="text-white text-3xl font-bold mb-6">User Profile</h2>
              <div className="space-y-4 text-white/80 mb-8">
                <p><span className="text-white font-medium">Email:</span> {user?.email}</p>
                <p><span className="text-white font-medium">Name:</span> {user?.displayName || "N/A"}</p>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Sidebar */}
      {showSidebar && (
        <div ref={sidebarRef} className="fixed inset-0 bg-black/80 z-[100] min-[1200px]:hidden">
          <div className="w-64 h-full bg-stone-950 p-6 flex flex-col gap-6 shadow-2xl">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-zinc-300 rounded-full flex items-center justify-center text-black font-bold">
                  {getUserInitials}
                </div>
                <div className="text-white text-sm font-medium truncate max-w-[120px]">{user?.email?.split('@')[0]}</div>
              </div>
              <button onClick={() => setShowSidebar(false)} className="text-white text-2xl cursor-pointer">✕</button>
            </div>
            <div className="flex flex-col gap-6">
              <Link to="/" onClick={() => setShowSidebar(false)} className="text-white text-2xl flex items-center gap-4">
                <Speedometer size={32} className="text-[#69639E]" /> Dashboard
              </Link>
              <Link to="/nodes" onClick={() => setShowSidebar(false)} className="text-white text-2xl flex items-center gap-4">
                <HardDrives size={32} className="text-[#69639E]" /> Nodes
              </Link>
              <Link to="/clusters" onClick={() => setShowSidebar(false)} className="text-white text-2xl flex items-center gap-4">
                <ShareNetwork size={32} className="text-[#69639E]" /> Clusters
              </Link>
              <Link to="/disks" onClick={() => setShowSidebar(false)} className="text-white text-2xl flex items-center gap-4">
                <Disc size={32} className="text-[#69639E]" /> Disks
              </Link>
              <Link to="/network" onClick={() => setShowSidebar(false)} className="text-white text-2xl flex items-center gap-4">
                <Network size={32} className="text-[#69639E]" /> Network
              </Link>
              <Link to="/docker" onClick={() => setShowSidebar(false)} className="text-white text-2xl flex items-center gap-4">
                <ShippingContainer size={32} className="text-[#69639E]" /> Docker
              </Link>
              <div className="h-px bg-white/10 my-2"></div>
              <button
                onClick={() => { setShowSidebar(false); setShowProfileModal(true); }}
                className="text-white text-2xl flex items-center gap-4 text-left cursor-pointer"
              >
                <User size={32} className="text-[#69639E]" /> Profile
              </button>
              <button
                onClick={() => { setShowSidebar(false); handleLogout(); }}
                className="text-red-400 text-2xl flex items-center gap-4 text-left cursor-pointer"
              >
                <SignOut size={32} className="text-red-400/60" /> Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NavItem({ label, to, icon, isActive }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-6 py-2 rounded-[20px] transition-all duration-300
        ${isActive ? "bg-white/[0.05] text-white" : "text-white/70 hover:text-white"}
      `}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

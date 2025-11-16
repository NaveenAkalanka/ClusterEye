import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { Speedometer, HardDrives, ShareNetwork, Disc, Network, Cube } from "@phosphor-icons/react"; // Importing Phosphor icons

export default function Navbar({ user }) {
  const [showMenu, setShowMenu] = useState(false); // To toggle the profile menu
  const [showProfileModal, setShowProfileModal] = useState(false); // To toggle profile modal visibility
  const [showSidebar, setShowSidebar] = useState(false); // To toggle sidebar on mobile
  const sidebarRef = useRef(null); // Ref for the sidebar
  const menuRef = useRef(null); // Ref for the dropdown menu
  const navigate = useNavigate(); // To navigate on Logout
  const location = useLocation(); // Get the current route

  // Logout function
  const handleLogout = async () => {
    await signOut(auth);
    setShowMenu(false); // Close menu after logout
  };

  // Get the first letter of the email (initials)
  const getUserInitials = user?.email?.[0]?.toUpperCase() || "U";

  // Determine the current active page
  const isActive = (path) => location.pathname === path;

  // Handle click outside the menu to close the dropdown
  const handleClickOutside = (e) => {
    if (menuRef.current && !menuRef.current.contains(e.target)) {
      setShowMenu(false); // Close menu when clicking outside
    }

    // Close sidebar if clicked outside of it
    if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
      setShowSidebar(false); // Close sidebar
    }
  };

  // Adding event listener to handle clicks outside the dropdown and sidebar
  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside); // Clean up the listener
  }, []);

  // Toggle Sidebar for mobile
  const toggleSidebar = () => setShowSidebar(!showSidebar);

  return (
    <>
      <div className="w-full h-24 bg-[#0D100D] rounded-[20px] relative flex items-center justify-between px-6 md:px-10">
        {/* Logo (click to go to Dashboard/Home) */}
        <Link to="/" className="flex items-center gap-3">
          <img src="src/assets/ClusterEye.svg" alt="ClusterEye Logo" className="w-14 h-14 md:w-12 md:h-12" />
          <div className="text-white text-4xl font-bold tracking-widest text-xl md:text-2xl">ClusterEye</div>
        </Link>

        {/* Navigation Links as buttons (Desktop view) */}
        <div className="flex items-center gap-12 text-white text-2xl relative hidden md:flex">
          <NavItem label="Dashboard" to="/" icon={<Speedometer size={32} className="text-[#69639E]" />} isActive={isActive("/")} />
          <NavItem label="Nodes" to="/nodes" icon={<HardDrives size={32} className="text-[#69639E]" />} isActive={isActive("/nodes")} />
          <NavItem label="Clusters" to="/clusters" icon={<ShareNetwork size={32} className="text-[#69639E]" />} isActive={isActive("/clusters")} />
          <NavItem label="Disks" to="/disks" icon={<Disc size={32} className="text-[#69639E]" />} isActive={isActive("/disks")} />
          <NavItem label="Network" to="/network" icon={<Network size={32} className="text-[#69639E]" />} isActive={isActive("/network")} />
          <NavItem label="Docker" to="/docker" icon={<Cube size={32} className="text-[#69639E]" />} isActive={isActive("/docker")} />
        </div>

        {/* Mobile Sidebar Icon */}
        <button
          className="md:hidden text-white text-3xl"
          onClick={toggleSidebar}
        >
          ☰ {/* Hamburger Icon */}
        </button>

        {/* Profile Button (Display Initials) */}
        <div
          ref={menuRef} // Attach the ref to the dropdown menu div
          className="relative flex items-center gap-3"
        >
          {/* Profile Button - Display user's initials */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black text-xl md:text-3xl font-bold transition-all duration-300 hover:bg-gray-700 cursor-pointer"
          >
            {getUserInitials} {/* Display user's initials */}
          </button>

          {/* Sub Navigation Bar (Dropdown menu for profile) */}
          {showMenu && (
            <div className="absolute top-20 right-1 bg-[#0D100D] p-4 rounded-lg shadow-lg w-80 md:w-70">
              {/* Profile Button to open Profile Modal */}
              <button
                onClick={() => setShowProfileModal(true)}
                className="w-full text-center bg-white/30 text-white py-2 rounded-lg hover:bg-white/40"
              >
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-center bg-white/20 text-white py-2 rounded-lg mt-2 hover:bg-white/50"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Profile Modal (Popup when Profile button is clicked) */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-gray-800 p-6 rounded-lg w-96">
              <div className="text-white text-3xl font-bold mb-4">User Profile</div>
              <div className="text-white mb-4">
                <div>Email: {user?.email}</div>
                <div>Full Name: {user?.displayName || "N/A"}</div>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="bg-red-500 text-white px-4 py-2 rounded-lg w-full hover:bg-red-600"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Sidebar (Responsive view) */}
      {showSidebar && (
        <div
          ref={sidebarRef} // Sidebar reference
          className="absolute top-0 left-0 w-64 h-full bg-[#0D100D] p-6 flex flex-col text-white shadow-lg z-50"
        >
          {/* Close Button - Centered */}
          <button
            onClick={() => setShowSidebar(false)}
            className="absolute top-10 left-1/2 transform -translate-x-1/2 text-white text-3xl"
          >
            ✖ {/* Close Sidebar */}
          </button>

          {/* Navigation Links in Sidebar */}
          <div className="relative top-25 flex flex-col items-center gap-10">
            <NavItem label="Dashboard" to="/" icon={<Speedometer size={32} className="text-[#69639E]" />} isActive={isActive("/")} className="bg-white/5 w-full text-center" />
            <NavItem label="Nodes" to="/nodes" icon={<HardDrives size={32} className="text-[#69639E]" />} isActive={isActive("/nodes")} className="bg-white/5 w-full text-center" />
            <NavItem label="Clusters" to="/clusters" icon={<ShareNetwork size={32} className="text-[#69639E]" />} isActive={isActive("/clusters")} className="bg-white/5 w-full text-center" />
            <NavItem label="Disks" to="/disks" icon={<Disc size={32} className="text-[#69639E]" />} isActive={isActive("/disks")} className="bg-white/5 w-full text-center" />
            <NavItem label="Network" to="/network" icon={<Network size={32} className="text-[#69639E]" />} isActive={isActive("/network")} className="bg-white/5 w-full text-center" />
            <NavItem label="Docker" to="/docker" icon={<Cube size={32} className="text-[#69639E]" />} isActive={isActive("/docker")} className="bg-white/5 w-full text-center" />
          </div>
        </div>
      )}
    </>
  );
}

// Reusable NavLink Component with Icon and Button Styling
function NavItem({ label, to, icon, isActive }) {
  return (
    <div className="relative">
      <Link
        to={to}
        className={`flex items-center bg-white/1 gap-2 px-6 py-3 rounded-[20px] transition-all duration-300 cursor-pointer
          ${isActive ? "bg-white/10 text-white border-white/0" : "text-white border-transparent hover:border-white hover:bg-gray-800"}
        `}
      >
        {icon} {/* Render the icon */}
        {label}
      </Link>
    </div>
  );
}

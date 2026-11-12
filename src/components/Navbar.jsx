import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseConfig";
import logoUrl from "../assets/ClusterEye.svg";
import { Speedometer, HardDrives, ShareNetwork, Disc, Network, User, SignOut, ShippingContainer, List, X } from "@phosphor-icons/react";
import useDialogFocus from "./useDialogFocus";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: Speedometer },
  { to: "/nodes", label: "Nodes", icon: HardDrives },
  { to: "/clusters", label: "Clusters", icon: ShareNetwork },
  { to: "/disks", label: "Disks", icon: Disc },
  { to: "/network", label: "Network", icon: Network },
  { to: "/docker", label: "Docker", icon: ShippingContainer },
];

export default function Navbar({ user }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const menuRef = useRef(null);
  const location = useLocation();
  const { dialogRef, onDialogKeyDown } = useDialogFocus(() => setShowSidebar(false), showSidebar);

  const handleLogout = async () => {
    await signOut(auth);
    setShowMenu(false);
  };

  const getUserInitials = (user?.displayName || user?.email)?.[0]?.toUpperCase() || "U";
  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    if (!showMenu) return undefined;
    const handlePointerDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setShowMenu(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowMenu(false);
        menuRef.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showMenu]);

  useEffect(() => {
    setShowMenu(false);
    setShowSidebar(false);
  }, [location.key]);

  return (
    <>
      <header className="nav-enter telemetry-navbar telemetry-surface relative flex h-16 w-full flex-shrink-0 items-center justify-between rounded-2xl border px-3 min-[1200px]:px-5">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 rounded-lg">
          <img src={logoUrl} alt="" className="size-8 object-contain" />
          <span className="text-base font-semibold tracking-[0.08em] text-white">ClusterEye</span>
        </Link>

        {/* Navigation Links (Desktop) */}
        <nav aria-label="Primary navigation" className="hidden items-center gap-1 text-sm text-white min-[1200px]:flex">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} to={item.to} label={item.label} icon={<item.icon size={18} className="text-accent" />} isActive={isActive(item.to)} />
          ))}
        </nav>

        {/* User Profile (Desktop) */}
        <div ref={menuRef} className="relative hidden items-center gap-3 min-[1200px]:flex">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="flex size-9 items-center justify-center rounded-xl bg-accent text-sm font-bold text-on-accent transition-colors hover:bg-accent-hover"
            aria-label="Account menu"
            aria-haspopup="true"
            aria-expanded={showMenu}
          >
            {getUserInitials}
          </button>

          {showMenu && (
            <div className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-line-strong bg-raised p-2 shadow-2xl animate-scaleIn">
              <div className="mb-1 border-b border-line px-3 pb-2.5 pt-1.5">
                {user?.displayName && <div className="truncate text-sm font-medium text-white">{user.displayName}</div>}
                <div className="truncate text-xs text-white/70">{user?.email}</div>
              </div>
              <Link
                to="/profile"
                onClick={() => setShowMenu(false)}
                className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm text-white transition-colors hover:bg-white/10"
              >
                <User size={20} className="text-accent" />
                Account Settings
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm text-white transition-colors hover:bg-white/10"
              >
                <SignOut size={20} className="text-accent" />
                Log Out
              </button>
            </div>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/5 min-[1200px]:hidden"
          onClick={() => setShowSidebar(true)}
          aria-label="Open menu"
          aria-expanded={showSidebar}
        >
          <List size={26} weight="bold" />
        </button>
      </header>

      {/* Mobile Sidebar */}
      {showSidebar && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          tabIndex={-1}
          onKeyDown={onDialogKeyDown}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowSidebar(false); }}
          className="fixed inset-0 z-[100] bg-black/70 animate-fadeIn min-[1200px]:hidden"
        >
          <nav aria-label="Mobile navigation" className="flex h-full w-[min(18rem,calc(100vw-1rem))] flex-col gap-5 overflow-y-auto border-r border-line bg-surface p-4 shadow-2xl animate-slideRight">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-bold text-on-accent">
                  {getUserInitials}
                </div>
                <div className="truncate text-sm font-medium text-white">{user?.displayName || user?.email}</div>
              </div>
              <button
                type="button"
                onClick={() => setShowSidebar(false)}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/5"
                aria-label="Close menu"
              >
                <X size={22} weight="bold" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {NAV_ITEMS.map((item) => (
                <MobileNavItem key={item.to} to={item.to} label={item.label} icon={<item.icon size={22} className="text-accent" />} isActive={isActive(item.to)} onClick={() => setShowSidebar(false)} />
              ))}

              <div className="my-3 h-px bg-line"></div>

              <MobileNavItem to="/profile" label="Account Settings" icon={<User size={22} className="text-accent" />} isActive={isActive("/profile")} onClick={() => setShowSidebar(false)} />

              <button
                type="button"
                onClick={() => { setShowSidebar(false); handleLogout(); }}
                className="flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-left text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
              >
                <SignOut size={22} className="text-accent" />
                Log Out
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

function NavItem({ label, to, icon, isActive }) {
  return (
    <Link
      to={to}
      aria-current={isActive ? "page" : undefined}
      className={`flex h-10 items-center gap-2 rounded-lg border px-3 font-medium transition-colors duration-200
        ${isActive
          ? "bg-white/[0.05] text-white border-line"
          : "text-white/70 border-transparent hover:text-white hover:bg-white/[0.03] hover:border-line"
        }
      `}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function MobileNavItem({ label, to, icon, isActive, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={`flex h-11 items-center gap-3 rounded-xl border px-3.5 text-sm font-medium transition-colors duration-200
        ${isActive ? "border-line-strong bg-accent/10 text-white" : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"}
      `}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

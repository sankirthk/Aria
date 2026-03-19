import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { LogOut, User, ChevronDown } from "lucide-react";
import GlassSurface from "../ui/GlassSurface";
import { useAuth } from "../../context/useAuth";
import { authClient } from "../../clients/authClient";
import { showToast } from "../../utils/toastService";
import "../../styles/NavBar.css";

const NavBar: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      setUser(null);
      showToast("Logged out successfully.", "success");
      window.location.href = "/login";
    } catch {
      showToast("Failed to log out. Please try again.", "error");
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="header-container">
      <GlassSurface
        width="60vw"
        height="6rem"
        borderRadius={20}
        backgroundOpacity={0.9}
        blur={0}
        saturation={3}
        opacity={1}
        className="navbar-pill glass"
      >
        <div className="left-section-nav">
          <span className="brand-logo" onClick={() => navigate("/dashboard")} title="Westside Medical Group">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="logo-grad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#1a2a5e"/>
                  <stop offset="100%" stopColor="#0a1628"/>
                </radialGradient>
              </defs>
              <rect width="40" height="40" rx="10" fill="url(#logo-grad)" stroke="rgba(59,130,246,0.5)" strokeWidth="1.5"/>
              <text x="20" y="28" textAnchor="middle" fontFamily="Georgia, serif" fontSize="22" fontWeight="bold" fill="white">W</text>
            </svg>
          </span>
        </div>

        <div className="right-section-nav">
          {/* User dropdown trigger */}
          <div className="navbar-user-dropdown" ref={dropdownRef}>
            <button
              type="button"
              className={`navbar-user-trigger${dropdownOpen ? " navbar-user-trigger--open" : ""}`}
              onClick={() => setDropdownOpen((o) => !o)}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              <div className="navbar-user">
                <span className="navbar-user__label">Patient</span>
                <span className="navbar-user__name">{user?.name || "Account"}</span>
              </div>
              <ChevronDown size={14} className={`navbar-user-chevron${dropdownOpen ? " navbar-user-chevron--up" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="navbar-dropdown">
                <button
                  type="button"
                  className="navbar-dropdown__item"
                  onClick={() => { setDropdownOpen(false); navigate("/profile"); }}
                >
                  <User size={14} />
                  My Profile
                </button>
                <div className="navbar-dropdown__divider" />
                <button
                  type="button"
                  className="navbar-dropdown__item navbar-dropdown__item--danger"
                  onClick={() => { setDropdownOpen(false); void handleLogout(); }}
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </GlassSurface>
    </header>
  );
};

export default NavBar;

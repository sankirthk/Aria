import { useState, useRef, useEffect } from "react";
import { UserRound, LogOut } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { logoutUser } from "../../api";
import GlassSurface from "../ui/GlassSurface";
import { showToast } from "../../utils/toastService";

const UserDropdown: React.FC = () => {
  const { user, setUser } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => setOpen((prev) => !prev);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const result = await logoutUser();
    if (result.success) {
      setUser(null);
      showToast(result.message || "Logged out successfully.", "success");
      window.location.href = "/";
    } else {
      showToast(result.message || "Failed to log out. Please try again.", "error");
    }
  };

  return (
    <div className="user-menu" ref={menuRef}>
      <div className="icon-wrapper" onClick={toggleDropdown}>
        <UserRound className="user-icon-button" />
      </div>

      {open && (
        <GlassSurface
          width="220px"
          height="auto"
          borderRadius={12}
          backgroundOpacity={0.3}
          blur={10}
          saturation={1.5}
          opacity={0.95}
          className="user-dropdown"
        >
          <p className="user-name">{user?.name || "User"}</p>
          <p className="user-email">{user?.email}</p>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={16} /> Log out
          </button>
        </GlassSurface>
      )}
    </div>
  );
};

export default UserDropdown;

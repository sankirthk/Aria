import type { FC } from "react";
import "../../styles/Header.css";
import { UserRound } from "lucide-react";
import GlassSurface from "../ui/GlassSurface";
import { useNavigate } from "react-router";

const Header: FC = () => {
  const navigate = useNavigate();
  return (
    <>
      <header className="header-container">
        <GlassSurface
          width={"60vw"}
          height={"6rem"}
          borderRadius={20}
          backgroundOpacity={0.25}
          blur={10}
          saturation={1}
          opacity={0.5}
          className="navbar-pill"
        >
          <div className="left-section">
            <span className="brand-logo" onClick={() => navigate("/")} title="Westside Medical Group">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <radialGradient id="logo-grad-h" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#1a2a5e"/>
                    <stop offset="100%" stopColor="#0a1628"/>
                  </radialGradient>
                </defs>
                <rect width="40" height="40" rx="10" fill="url(#logo-grad-h)" stroke="rgba(59,130,246,0.5)" strokeWidth="1.5"/>
                <text x="20" y="28" textAnchor="middle" fontFamily="Georgia, serif" fontSize="22" fontWeight="bold" fill="white">W</text>
              </svg>
            </span>
          </div>
          <div className="right-section">
            <div className="icon-wrapper">
              <UserRound
                className="login-button"
                onClick={() => navigate("/login")}
              />
              <span className="tooltip">Login</span>
            </div>
          </div>
        </GlassSurface>
      </header>
    </>
  );
};

export default Header;

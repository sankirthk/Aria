import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import NavBar from "../components/layout/Navbar";
import GlassSurface from "../components/ui/GlassSurface";
import AppointmentPanel from "../components/appointments/AppointmentPanel";
import ChatPanel from "../components/chat/ChatPanel";
import ProfileSetupModal from "../components/dashboard/ProfileSetupModal";
import { getProfile } from "../api/patient";
import type { Booking } from "../api/appointments";
import "../styles/Dashboard.css";

const DashboardPage = () => {
  const [newBooking, setNewBooking] = useState<Booking | null>(null);
  const [profileComplete, setProfileComplete] = useState(true); // optimistic default
  const [showProfileModal, setShowProfileModal] = useState(false);
  const pageRef = useRef<HTMLElement>(null);

  // Fetch profile on mount — show setup modal if incomplete
  useEffect(() => {
    const checkProfile = async () => {
      const result = await getProfile();
      if (!result.success || !result.data || !result.data.profileComplete) {
        setProfileComplete(false);
        setShowProfileModal(true);
      } else {
        setProfileComplete(true);
      }
    };
    void checkProfile();
  }, []);

  useEffect(() => {
    if (!pageRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".appointment-panel-glass, .chat-panel-glass",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.55, stagger: 0.1, ease: "power2.out" }
      );
    }, pageRef);
    return () => ctx.revert();
  }, []);

  const handleProfileComplete = () => {
    setProfileComplete(true);
    setShowProfileModal(false);
  };

  const handleProfileSkip = () => {
    setShowProfileModal(false);
  };

  return (
    <>
      <NavBar />
      <main className="dashboard-page" ref={pageRef}>
        <GlassSurface
          width="30%"
          height="auto"
          borderRadius={20}
          backgroundOpacity={0.08}
          blur={20}
          saturation={1.5}
          opacity={1}
          className="appointment-panel-glass"
        >
          <AppointmentPanel newBooking={newBooking} />
        </GlassSurface>

        <GlassSurface
          width="68%"
          height="auto"
          borderRadius={20}
          backgroundOpacity={0.08}
          blur={20}
          saturation={1.5}
          opacity={1}
          className="chat-panel-glass"
        >
          <ChatPanel
            onNewBooking={(booking) => setNewBooking(booking)}
            profileComplete={profileComplete}
          />
        </GlassSurface>
      </main>

      {showProfileModal && (
        <ProfileSetupModal
          onComplete={handleProfileComplete}
          onSkip={handleProfileSkip}
        />
      )}
    </>
  );
};

export default DashboardPage;

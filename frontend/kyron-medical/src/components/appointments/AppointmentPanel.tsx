import { useEffect, useRef, useState, type FC } from "react";
import gsap from "gsap";
import { getAppointments, type Booking } from "../../api/appointments";
import AppointmentCard from "./AppointmentCard";
import { CalendarCheck } from "lucide-react";
import { PROFILE_UPDATED_EVENT } from "../../utils/profileEvents";

interface AppointmentPanelProps {
  /** Called by ChatPanel with the new booking from the SSE `done` event (REQ-025) */
  newBooking?: Booking | null;
}

const AppointmentPanel: FC<AppointmentPanelProps> = ({ newBooking }) => {
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [past, setPast] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      const res = await getAppointments();
      if (cancelled) return;
      if (res.success && res.data) {
        setUpcoming(res.data.upcoming);
        setPast(res.data.past);
      } else {
        setUpcoming([]);
        setPast([]);
        setError(res.error ?? "Failed to load appointments.");
      }
      setLoading(false);
    };

    const handleProfileUpdated = () => {
      void load();
    };

    void load();
    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
    };
  }, []);

  // REQ-025: append new booking directly without refetch
  useEffect(() => {
    if (!newBooking) return;
    setUpcoming((prev) => {
      // avoid duplicates if SSE fires more than once
      if (prev.some((b) => b.id === newBooking.id)) return prev;
      return [newBooking, ...prev];
    });
  }, [newBooking]);

  // Stagger cards when data loads
  useEffect(() => {
    if (!loading && cardsRef.current) {
      const cards = cardsRef.current.querySelectorAll(".appointment-card");
      if (cards.length > 0) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, stagger: 0.08, duration: 0.4, ease: "power2.out" }
        );
      }
    }
  }, [loading, upcoming, past]);

  return (
    <div className="appointment-panel glass">
      <div className="appointment-panel__header">
        <CalendarCheck size={18} />
        <h2 className="appointment-panel__title">Appointments</h2>
      </div>

      {loading && (
        <div className="appointment-panel__state">
          <span className="appointment-panel__loading-text">Loading appointments…</span>
        </div>
      )}

      {!loading && error && (
        <div className="appointment-panel__state appointment-panel__state--error">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div ref={cardsRef}>
          <section className="appointment-panel__section">
            <h3 className="appointment-panel__section-title">Upcoming</h3>
            {upcoming.length === 0 ? (
              <p className="appointment-panel__empty">
                No upcoming appointments. Ask Aria to schedule one!
              </p>
            ) : (
              upcoming.map((b) => (
                <AppointmentCard key={b.id} booking={b} isPast={false} />
              ))
            )}
          </section>

          {past.length > 0 && (
            <section className="appointment-panel__section">
              <h3 className="appointment-panel__section-title">Past</h3>
              {past.map((b) => (
                <AppointmentCard key={b.id} booking={b} isPast={true} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default AppointmentPanel;

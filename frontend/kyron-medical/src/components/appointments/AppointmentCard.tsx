import type { FC } from "react";
import type { Booking } from "../../api/appointments";
import { Calendar, Clock, User } from "lucide-react";

interface AppointmentCardProps {
  booking: Booking;
  isPast?: boolean;
}

const LA_TZ = "America/Los_Angeles";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: LA_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: LA_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const AppointmentCard: FC<AppointmentCardProps> = ({ booking, isPast = false }) => {
  return (
    <div
      className={`appointment-card glass ${
        isPast ? "appointment-card--past" : "appointment-card--upcoming"
      }`}
    >
      <div className="appointment-card__provider">
        <User size={14} className="appointment-card__icon" />
        <span className="appointment-card__name">{booking.provider.name}</span>
        <span className="appointment-card__specialty">{booking.provider.specialty}</span>
      </div>
      <div className="appointment-card__time">
        <div className="appointment-card__date">
          <Calendar size={13} className="appointment-card__icon" />
          <span>{formatDate(booking.slot.startTime)}</span>
        </div>
        <div className="appointment-card__clock">
          <Clock size={13} className="appointment-card__icon" />
          <span>{formatTime(booking.slot.startTime)} – {formatTime(booking.slot.endTime)}</span>
        </div>
      </div>
      {!isPast && (
        <div className="appointment-card__badge appointment-card__badge--confirmed">
          Confirmed
        </div>
      )}
      {isPast && (
        <div className="appointment-card__badge appointment-card__badge--past">
          Completed
        </div>
      )}
    </div>
  );
};

export default AppointmentCard;

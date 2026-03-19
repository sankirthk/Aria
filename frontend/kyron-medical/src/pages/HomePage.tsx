import NavBar from "../components/layout/Navbar";
import type { FC } from "react";
import "../styles/HomePage.css";

const HomePage: FC = () => {
  return (
    <>
      <NavBar />
      <main className="hero-section">
        <div className="hero-text">
          <p className="hero-badge">Westside Medical Group</p>
          <h1>Book care by chat or phone.</h1>
          <p>
            Aria helps patients schedule appointments, reschedule visits, and
            connect with the right doctor at a single multi-specialty practice.
          </p>
        </div>
      </main>
    </>
  );
};

export default HomePage;

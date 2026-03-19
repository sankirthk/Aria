import type { FC } from "react";
import ShinyText from "../ui/ShintyText";
import "../../styles/CTASection.css";
import { useNavigate } from "react-router";

const CTASecction: FC = () => {
  const navigate = useNavigate();
  return (
    <>
      <section className="cta">
        <ShinyText text={"Westside Medical Group"} speed={5} className="header" />
        <h2 className="subheader">
          Schedule appointments, manage your care, and connect with your
          providers — all in one place.
        </h2>
        <button
          className="login-btn"
          type="button"
          onClick={() => navigate("/login")}
        >
          Login to Dashboard
        </button>
      </section>
    </>
  );
};

export default CTASecction;

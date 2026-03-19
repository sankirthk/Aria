import { type FC } from "react";
import Header from "../components/layout/Header";
import CTASecction from "../components/cards/CTA";

const LandingPage: FC = () => {
  return (
    <>
      <Header />
      <CTASecction />
    </>
  );
};

export default LandingPage;

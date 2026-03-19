import MakeCallForm from "../components/Forms/MakeCallForm";
import NavBar from "../components/layout/Navbar";
import type { FC } from "react";
import "../styles/HomePage.css";

const HomePage: FC = () => {
  return (
    <>
      <NavBar />
      <MakeCallForm />
    </>
  );
};

export default HomePage;

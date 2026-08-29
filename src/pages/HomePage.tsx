import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Footer, JoinCta } from "../components/Closing";
import { Features } from "../components/Features";
import { Hero } from "../components/Hero";
import { Learn } from "../components/Learn";
import { Stats } from "../components/Stats";
import { Ticker } from "../components/Ticker";

export function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();

  // arriving from another route with a target section (e.g. navbar "Puzzles" clicked on /play)
  useEffect(() => {
    const target = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (!target) return;
    const timer = window.setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      navigate(location.pathname, { replace: true });
    }, 90);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  return (
    <>
      <main>
        <Hero />
        <Ticker />
        <Features />
        <Learn />
        <Stats />
        <JoinCta />
      </main>
      <Footer />
    </>
  );
}

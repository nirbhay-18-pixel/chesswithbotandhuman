import { Footer, JoinCta } from "./components/Closing";
import { Features } from "./components/Features";
import { Hero } from "./components/Hero";
import { Learn } from "./components/Learn";
import { Navbar } from "./components/Navbar";
import { Stats } from "./components/Stats";
import { Ticker } from "./components/Ticker";
import { ToastProvider } from "./components/ui";

export default function App() {
  return (
    <ToastProvider>
      <div className="bg-stage" aria-hidden="true" />
      <Navbar />
      <main>
        <Hero />
        <Ticker />
        <Features />
        <Learn />
        <Stats />
        <JoinCta />
      </main>
      <Footer />
    </ToastProvider>
  );
}

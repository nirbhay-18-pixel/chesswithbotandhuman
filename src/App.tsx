import { useEffect } from "react";
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { ToastProvider } from "./components/ui";
import { HomePage } from "./pages/HomePage";
import { PlayPage } from "./pages/PlayPage";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <div className="bg-stage" aria-hidden="true" />
        <ScrollToTop />
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/play" element={<PlayPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </ToastProvider>
    </HashRouter>
  );
}

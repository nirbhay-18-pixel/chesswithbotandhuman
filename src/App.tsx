import { useEffect } from "react";
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { ToastProvider } from "./components/ui";
import { BotPage } from "./pages/BotPage";
import { FriendPage } from "./pages/FriendPage";
import { HomePage } from "./pages/HomePage";
import { OnlinePage } from "./pages/OnlinePage";
import { PlayHub } from "./pages/PlayHub";
import { ProfilePage } from "./pages/ProfilePage";

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
          <Route path="/play" element={<PlayHub />} />
          <Route path="/play/bot" element={<BotPage />} />
          <Route path="/play/friend" element={<FriendPage />} />
          <Route path="/play/online" element={<OnlinePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </ToastProvider>
    </HashRouter>
  );
}

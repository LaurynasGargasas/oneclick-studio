import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { ToastContainer } from "@/components/hud";
import { useSettings } from "@/stores/settingsStore";

export function Layout() {
  const location = useLocation();
  const loadSettings = useSettings((s) => s.load);
  const settingsLoaded = useSettings((s) => s.loaded);

  useEffect(() => {
    if (!settingsLoaded) {
      void loadSettings();
    }
  }, [settingsLoaded, loadSettings]);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-bg-base text-fg">
      <Sidebar />

      <main className="relative flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex-1 overflow-y-auto overflow-x-hidden"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <ToastContainer />
    </div>
  );
}

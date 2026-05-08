import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Film, Folder, Boxes, Settings as SettingsIcon, Sparkles, Wand2, UserCog } from "lucide-react";
import { cn } from "@/lib/cn";
import { useSettings } from "@/stores/settingsStore";
import { useGenerations } from "@/stores/generationsStore";

const NAV_ITEMS = [
  { to: "/", label: "Feed", icon: Film, end: true },
  { to: "/generate", label: "Generate", icon: Wand2, end: false },
  { to: "/character", label: "Characters", icon: UserCog, end: false },
  { to: "/projects", label: "Projects", icon: Folder, end: false },
  { to: "/elements", label: "Elements", icon: Boxes, end: false },
  { to: "/settings", label: "Settings", icon: SettingsIcon, end: false },
];

export function Sidebar() {
  const apiKey = useSettings((s) => s.apiKey);
  const apiConfigured = apiKey.length > 0;
  const renderingCount = useGenerations((s) => s.pollingIds.size);

  return (
    <aside className="relative flex flex-col w-[220px] flex-shrink-0 border-r border-border-hud bg-bg-panel/40 backdrop-blur-md">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-border-hud">
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 flex items-center justify-center border border-hud-cyan hud-glow-cyan">
            <Sparkles className="w-4 h-4 text-hud-cyan" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-hud-cyan hud-text-glow-cyan">
              OneClick
            </span>
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-fg-muted">
              Studio
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="font-mono text-[0.55rem] tracking-[0.15em] text-fg-dim">v0.1.0</span>
          <span className="flex-1 h-px bg-border-hud" />
          <span className="font-mono text-[0.55rem] tracking-[0.15em] text-fg-dim">BUILD.A1</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-3 flex-1">
        <div className="hud-label text-fg-dim px-3 py-2">Navigation</div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 px-3 py-2.5",
                "border border-transparent transition-all duration-150",
                "hud-focus",
                isActive
                  ? "bg-hud-cyan/[0.08] border-hud-cyan/40 text-hud-cyan"
                  : "text-fg-muted hover:text-fg hover:bg-bg-elevated/40 hover:border-border-hud",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="nav-active-bar"
                    className="absolute left-0 top-0 bottom-0 w-0.5 bg-hud-cyan hud-glow-cyan"
                    transition={{ type: "spring", stiffness: 600, damping: 35 }}
                  />
                )}
                <item.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.15em] flex-1">
                  {item.label}
                </span>
                {/* Rendering badge on Feed item */}
                {item.to === "/" && renderingCount > 0 && (
                  <span className="font-mono text-[0.55rem] tabular-nums px-1.5 py-0.5 bg-hud-amber/20 border border-hud-amber/50 text-hud-amber hud-pulse">
                    {renderingCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Status panel */}
      <div className="p-3 border-t border-border-hud">
        <div className="relative border border-border-hud bg-bg-elevated/40 p-3">
          <div className="hud-label text-fg-dim mb-2">System Status</div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                apiConfigured ? "bg-hud-green hud-pulse" : "bg-hud-amber hud-pulse",
              )}
            />
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-fg">
              {apiConfigured ? "API Linked" : "API Not Set"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-hud-green" />
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-fg-muted">
              Local DB
            </span>
          </div>
          {renderingCount > 0 && (
            <div className="mt-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-hud-amber hud-pulse" />
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-hud-amber">
                {renderingCount} Rendering
              </span>
            </div>
          )}
        </div>

        <NavLink
          to="/dev/hud"
          className="mt-2 block text-center font-mono text-[0.55rem] uppercase tracking-[0.18em] text-fg-dim hover:text-hud-magenta transition-colors py-1"
        >
          /dev/hud
        </NavLink>
      </div>
    </aside>
  );
}

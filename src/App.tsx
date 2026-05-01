import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./routes/Layout";
import { GenerationsFeed } from "./routes/GenerationsFeed";
import { Projects } from "./routes/Projects";
import { ProjectDetail } from "./routes/ProjectDetail";
import { Elements } from "./routes/Elements";
import { Generator } from "./routes/Generator";
import { Settings } from "./routes/Settings";
import { HudDemo } from "./routes/HudDemo";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<GenerationsFeed />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/elements" element={<Elements />} />
        <Route path="/generate" element={<Generator />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/dev/hud" element={<HudDemo />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

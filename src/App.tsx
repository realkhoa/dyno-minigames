import { useEffect } from "react";
import { TangoGame } from "./games/tango/TangoGame";
import { useHashRoute } from "./lib/router";
import { Dashboard } from "./pages/Dashboard";

export default function App() {
  const route = useHashRoute();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route]);

  if (route === "tango") return <TangoGame />;
  return <Dashboard />;
}

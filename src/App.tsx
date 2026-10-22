import { useEffect } from "react";
import { QueensGame } from "./games/queens/QueensGame";
import { TangoGame } from "./games/tango/TangoGame";
import { useHashRoute } from "./lib/router";
import { Dashboard } from "./pages/Dashboard";

export default function App() {
  const route = useHashRoute();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route]);

  switch (route) {
    case "tango":
      return <TangoGame />;
    case "queens":
      return <QueensGame />;
    default:
      return <Dashboard />;
  }
}

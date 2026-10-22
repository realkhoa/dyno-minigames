import { useEffect } from "react";
import { QueensGame } from "./games/queens/QueensGame";
import { SudokuGame } from "./games/sudoku/SudokuGame";
import { TangoGame } from "./games/tango/TangoGame";
import { ZipGame } from "./games/zip/ZipGame";
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
    case "zip":
      return <ZipGame />;
    case "sudoku":
      return <SudokuGame />;
    default:
      return <Dashboard />;
  }
}

import { useEffect, useState } from "react";

function normalize(hash: string): string {
  return hash.replace(/^#\/?/, "").replace(/\/+$/, "");
}

/** Minimal hash router: "" is the dashboard, "tango" is the game. */
export function useHashRoute(): string {
  const [route, setRoute] = useState(() => normalize(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(normalize(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}

export function navigate(route: string): void {
  window.location.hash = `/${route}`;
}

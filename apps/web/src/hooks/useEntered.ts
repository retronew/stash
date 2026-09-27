import { useEffect, useState } from "react";

/**
 * false on the first frame, then true. Callable dialogs start closed so
 * Base UI has a real false→true transition to animate.
 */
export function useEntered(): boolean {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return entered;
}

import { useEffect, useState } from "react";
import { breakpoints } from "./theme";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= breakpoints.mobile);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoints.mobile);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isMobile;
}

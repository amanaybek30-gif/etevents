import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const scrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTo?.(0, 0);
      document.body.scrollTo?.(0, 0);
    };

    scrollToTop();

    const raf = window.requestAnimationFrame(scrollToTop);
    const timeout = window.setTimeout(scrollToTop, 60);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [pathname, search, hash]);

  return null;
};

export default ScrollToTop;

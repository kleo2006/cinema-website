import React, { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigationType } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";

/** Shell: skip link, header, main landmark, footer. Moves focus and scroll to the new page on navigation. */
export default function Layout() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  const main = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // Back/forward restore the browser's own scroll; new navigations start at the top.
    if (navType !== "POP") window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [pathname, navType]);

  // "/" jumps to search, like most media sites. Ignored while typing or with modifier keys.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const input = document.querySelector(".header-search input");
      if (input && input.offsetParent !== null) {
        e.preventDefault();
        input.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="page">
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main" className="main" ref={main} tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

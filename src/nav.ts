import type { NavigateFunction } from "react-router-dom";

/**
 * Jump to a homepage section — scrolls directly when already on "/",
 * otherwise navigates home first and lets HomePage perform the scroll.
 */
export function goToSection(navigate: NavigateFunction, pathname: string, sectionId: string) {
  if (pathname === "/") {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    navigate("/", { state: { scrollTo: sectionId } });
  }
}

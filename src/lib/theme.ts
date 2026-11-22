// Shared by the server layout (inline script) and the client ThemeMenu.
// Kept out of the "use client" module so the server gets the real string.

export type Theme = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

/**
 * Runs in <head> before first paint so a forced theme never flashes the
 * system one. No data-theme attribute = follow prefers-color-scheme.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

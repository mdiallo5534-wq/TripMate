"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Check saved preference or system preference
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = saved || (systemPrefersDark ? "dark" : "light");

    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("theme", nextTheme);
  };

  // Render a placeholder during SSR to avoid mismatch
  if (!mounted) {
    return (
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border)",
          backgroundColor: "transparent"
        }}
      />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      className="btn btn-outline"
      style={{
        padding: "0.55rem",
        borderRadius: "var(--radius-md)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: theme === "dark" ? "#FBBF24" : "var(--color-dark-navy)",
        border: "1px solid var(--color-border)",
        transition: "all 0.2s ease"
      }}
      title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
    >
      {theme === "light" ? (
        <Moon size={18} />
      ) : (
        <Sun size={18} />
      )}
    </button>
  );
};

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "procar_theme";

/**
 * Alterna entre o tema escuro (Carbono Racing, padrão) e o claro.
 * A escolha persiste em localStorage e é reaplicada no boot por um
 * script inline no index.html (evita flash de tema errado).
 */
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      // localStorage indisponível (ex.: modo privado) — só não persiste
    }
  };

  return (
    <button
      onClick={toggle}
      title={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className="fixed top-3 right-3 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground shadow-sm backdrop-blur-md transition-colors hover:border-primary/50 hover:text-primary cursor-pointer"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

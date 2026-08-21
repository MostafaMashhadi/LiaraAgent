import React from 'react';
import { LuSun, LuMoon } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';

interface ThemeToggleProps {}

export default function ThemeToggle({}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="rounded-xl"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <LuMoon className="h-4 w-4" />
      ) : (
        <LuSun className="h-4 w-4" />
      )}
    </Button>
  );
}


import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ThemeChoice } from "@/lib/theme";
import { applyTheme, getCurrentTheme } from "@/lib/theme";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>("system");

  // Keep local state in sync with stored theme when dialog opens
  useEffect(() => {
    if (open) {
      const current = getCurrentTheme();
      setTheme(current);
    }
  }, [open]);

  // Open when backend emits "open-settings"
  useEffect(() => {
    const unlisten = listen("open-settings", () => setOpen(true));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Also support internal CustomEvent("open-settings")
  useEffect(() => {
    const onCustom = () => setOpen(true);
    window.addEventListener("open-settings", onCustom as EventListener);
    return () => {
      window.removeEventListener("open-settings", onCustom as EventListener);
    };
  }, []);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Basic preferences for brsr.</DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-2">
          <div className="space-y-1">
            <Label htmlFor="theme-select">Theme</Label>
            <Select
              onValueChange={async (value) => {
                const next = value as ThemeChoice;
                setTheme(next);
                await applyTheme(next);
              }}
              value={theme}
            >
              <SelectTrigger aria-label="Theme" id="theme-select" type="button">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

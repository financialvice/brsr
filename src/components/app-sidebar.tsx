import { Home, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  return (
    <Sidebar>
      <div className="h-12 w-full" data-tauri-drag-region />
      <SidebarHeader>
        <div className="px-2 font-semibold">brsr</div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Home />
                  <span>Home</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-2">
          <Button
            className="w-full justify-start"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("open-settings"));
            }}
            type="button"
            variant="ghost"
          >
            <Settings />
            <span>Settings…</span>
            <span className="ml-auto text-muted-foreground text-xs">⌘ ,</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

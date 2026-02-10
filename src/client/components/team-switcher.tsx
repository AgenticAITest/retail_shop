import { ChevronsUpDown, GalleryVerticalEnd, Plus } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@client/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@client/components/ui/sidebar"
import { useAuth } from "@client/provider/AuthProvider"
import { useTenant } from "@client/provider/TenantProvider"
import { use, useEffect, useState } from "react"
import axios from "axios"
import { toast } from "sonner"

interface Tenant {
  id: string
  code: string
  name: string
  description: string
}

export function TeamSwitcher() {
  const { isMobile } = useSidebar()
  const [userTenants, setUserTenants] = useState<Tenant[]>([])  
  const { user: authUser } = useAuth();
  const { tenant: currentTenant, switchTenant, loading: tenantLoading } = useTenant();

  async function setActiveTenant(tenant: Tenant) {
    try {
      await switchTenant(tenant.code);
      toast(`Switched to tenant: ${tenant.name}`);
    } catch (error) {
      console.error("Error switching tenant:", error);
      toast.error("Failed to switch tenant.");
    }
  }

  // useEffect(() => {
  //   axios.get("/api/system/user/user-tenants")
  //   .then((response) => {
  //     setUserTenants(response.data); 
  //   })
  // }, [])

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <GalleryVerticalEnd className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {currentTenant?.name || authUser?.activeTenant?.name || 'Loading...'}
                </span>
                <span className="truncate text-xs">
                  {currentTenant?.code || authUser?.activeTenant?.code || ''}
                </span>
              </div>
              {/* <ChevronsUpDown className="ml-auto" /> */}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          {/* <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Tenants
            </DropdownMenuLabel>
            {userTenants.map((tenant, index) => (
              <DropdownMenuItem
                key={tenant.code}
                onClick={() => setActiveTenant(tenant)}
                className={`gap-2 p-2 ${tenantLoading ? 'opacity-50 pointer-events-none' : ''}`}
                disabled={tenantLoading || currentTenant?.code === tenant.code}
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <GalleryVerticalEnd className="size-3.5 shrink-0" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium">{tenant.name}</span>
                  <span className="text-xs text-muted-foreground">{tenant.code}</span>
                </div>
                {currentTenant?.code === tenant.code && (
                  <span className="ml-auto text-xs text-muted-foreground">Current</span>
                )}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="text-muted-foreground font-medium">Add team</div>
            </DropdownMenuItem>
          </DropdownMenuContent> */}
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

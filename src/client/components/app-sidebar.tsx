import {
  BookOpen,
  Puzzle,
  Settings2,
  SquareTerminal
} from "lucide-react"
import * as React from "react"

import { NavMain } from "@client/components/nav-main"
import { NavUser } from "@client/components/nav-user"
import { TeamSwitcher } from "@client/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@client/components/ui/sidebar"

import { demoModuleSidebarMenus } from "../../modules/demo-module/client/menus/sideBarMenus"

import { showcaseModuleSidebarMenus } from "../../modules/showcase-module/client/menus/sideBarMenus"
import { integrationSidebarMenus } from "../../modules/integration/client/menus/sideBarMenus"
import { locationManagementSidebarMenus } from "../../modules/location-management/client/menus/sideBarMenus"
import { taxConfigurationSidebarMenus } from "../../modules/tax-configuration/client/menus/sideBarMenus"
import { productCatalogSidebarMenus } from "../../modules/product-catalog/client/menus/sideBarMenus"
import { approvalEngineSidebarMenus } from "../../modules/approval-engine/client/menus/sideBarMenus"
import { supplierManagementSidebarMenus } from "../../modules/supplier-management/client/menus/sideBarMenus"
import { tenantOnboardingSidebarMenus } from "../../modules/tenant-onboarding/client/menus/sideBarMenus"
import { purchaseOrderSidebarMenus } from "../../modules/purchase-order/client/menus/sideBarMenus"
import { grnSidebarMenus } from "../../modules/grn/client/menus/sideBarMenus"
import { supplierReturnSidebarMenus } from "../../modules/supplier-return/client/menus/sideBarMenus"
import { posSidebarMenus } from "../../modules/pos/client/menus/sideBarMenus"
import { transferSidebarMenus } from "../../modules/transfer/client/menus/sideBarMenus"
import { inventoryMgmtSidebarMenus } from "../../modules/inventory-management/client/menus/sideBarMenus"
import { reportSidebarMenus } from "../../modules/report/client/menus/sideBarMenus"
import { mokaMigrationSidebarMenus } from "../../modules/moka-migration/client/menus/sideBarMenus"
const data = {
  navMain: [
    {
      id: "dashboard",
      title: "Dashboard",
      url: "/console/dashboard",
      icon: SquareTerminal,
      isActive: true,
    },
    {
      id: "system",
      title: "System",
      url: "/console/system",
      icon: Settings2,
      permissions: ["system.tenant.view", "system.permission.view", "system.role.view", "system.user.view", "system.option.view"],
      items: [
        {
          id: "tenant",
          title: "Tenant",
          url: "/console/system/tenant",
          permissions: "system.tenant.view",
        },
        {
          id: "permission",
          title: "Permission",
          url: "/console/system/permission",
          permissions: "system.permission.view",
        },
        {
          id: "role",
          title: "Role",
          url: "/console/system/role",
          permissions: "system.role.view",
        },
        {
          id: "user",
          title: "User",
          url: "/console/system/user",
          permissions: "system.user.view",
        },
        {
          id: "option",
          title: "Option",
          url: "/console/system/option",
          permissions: "system.option.view",
        },
        {
          id: "module-authorization",
          title: "Modules",
          url: "/console/system/module-authorization",
          permissions: "system.module.view",
        },
        {
          id: "module-registry",
          title: "Module Registry",
          url: "/console/system/module-registry",
          roles: "SYSADMIN",
          permissions: "system.module-registry.view",
        },
      ],
    },
    showcaseModuleSidebarMenus,

    integrationSidebarMenus,


    demoModuleSidebarMenus,
    locationManagementSidebarMenus,
    taxConfigurationSidebarMenus,
    productCatalogSidebarMenus,
    approvalEngineSidebarMenus,
    supplierManagementSidebarMenus,
    purchaseOrderSidebarMenus,
    grnSidebarMenus,
    supplierReturnSidebarMenus,
    posSidebarMenus,
    transferSidebarMenus,
    inventoryMgmtSidebarMenus,
    reportSidebarMenus,
    mokaMigrationSidebarMenus,
    tenantOnboardingSidebarMenus,
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <TeamSwitcher/>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {/* <NavProjects projects={data.projects} /> */}
      </SidebarContent>
      <SidebarFooter>
        <NavUser/>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

import { Puzzle } from 'lucide-react';

export const demoModuleSidebarMenus = {
    id: 'demo-module',
    title: 'Demo Module',
    url: '/console/modules/demo-module',
    icon: Puzzle,
    roles: 'ADMIN', 
    permissions: ['demo-module.department.view', 'demo-module.employee.view', 'demo-module.document.view'],
    items: [
      {
      id: "document",
      title: "Document",
      url: "/console/modules/demo-module/document",
      roles: "ADMIN",
      permissions: "demo-module.document.view",
      },
      {
        id: "department",
        title: "Department",
        url: "/console/modules/demo-module/department",
        roles: "ADMIN",
        permissions: "demo-module.department.view",
      },
      {
        id: "employee",
        title: "Employee",
        url: "/console/modules/demo-module/employee",
        roles: "ADMIN",
        permissions: "demo-module.employee.view",
      },
    ],
  };

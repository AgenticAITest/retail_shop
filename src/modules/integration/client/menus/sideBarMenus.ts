import { SquaresIntersect } from 'lucide-react';

export const integrationSidebarMenus = {
    id: 'integration',
    title: 'Integration',
    url: '/console/modules/integration',
    icon: SquaresIntersect, 
    roles: 'ADMIN', 
    permissions: ['integration.view'],
    items: [
      {
        id: "partner",
        title: "Partners",
        url: "/console/modules/integration/partner",
        roles: "ADMIN",
        permissions: "integration.view",
      },
      {
        id: "event",
        title: "Events",
        url: "/console/modules/integration/event",
        roles: "ADMIN",
        permissions: "integration.view",
      },
      {
        id: "api-key",
        title: "API Keys",
        url: "/console/modules/integration/api-key",
        roles: "ADMIN",
        permissions: "integration.view",
      },
      {
        id: "webhook",
        title: "Webhooks",
        url: "/console/modules/integration/webhook",
        roles: "ADMIN",
        permissions: "integration.view",
      },
    ],
  };

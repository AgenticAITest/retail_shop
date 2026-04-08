import { Rocket } from 'lucide-react';

export const tenantOnboardingSidebarMenus = {
  id: 'tenant-onboarding',
  title: 'Onboarding',
  url: '/console/modules/tenant-onboarding',
  icon: Rocket,
  roles: 'ADMIN',
  permissions: ['tenant-onboarding.wizard.view'],
  items: [
    {
      id: "wizard",
      title: "Setup Wizard",
      url: "/console/modules/tenant-onboarding/wizard",
      roles: "ADMIN",
      permissions: "tenant-onboarding.wizard.view",
    },
  ],
};

import { MapPin } from 'lucide-react';

export const locationManagementSidebarMenus = {
  id: 'location-management',
  title: 'Locations',
  url: '/console/modules/location-management',
  icon: MapPin,
  roles: 'ADMIN',
  permissions: ['retail.location.view'],
  items: [
    {
      id: "location",
      title: "All Locations",
      url: "/console/modules/location-management/location",
      roles: "ADMIN",
      permissions: "retail.location.view",
    },
  ],
};

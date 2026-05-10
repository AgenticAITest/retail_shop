import { FileUp } from 'lucide-react';

export const mokaMigrationSidebarMenus = {
  id: 'moka-migration',
  title: 'MokaPOS Migration',
  url: '/console/modules/moka-migration',
  icon: FileUp,
  roles: ['ADMIN'],
  permissions: ['moka-migration.migration.view'],
  items: [
    {
      id: 'moka-import',
      title: 'Import CSV',
      url: '/console/modules/moka-migration/import',
      roles: ['ADMIN'],
      permissions: 'moka-migration.migration.import',
    },
    {
      id: 'moka-history',
      title: 'Import History',
      url: '/console/modules/moka-migration/history',
      roles: ['ADMIN'],
      permissions: 'moka-migration.migration.view',
    },
  ],
};

/**
 * Module Registration Helper
 * 
 * This file provides utilities to help register modules.
 * While registration is manual as requested, these utilities
 * can make the process easier and more consistent.
 */

export interface ModuleRoute {
  path: string;
  children: Array<{
    index?: boolean;
    path?: string;
    Component: React.ComponentType;
  }>;
}

export interface ModuleMenuItem {
  id: string;
  title: string;
  url: string;
  icon: React.ComponentType;
  roles?: string | string[];
  permissions?: string | string[];
  items?: Array<{
    id: string;
    title: string;
    url: string;
    roles?: string | string[];
    permissions?: string | string[];
  }>;
}

export interface ModuleServerRoute {
  path: string;
  router: any; // Express router
}

/**
 * Helper function to validate module route structure
 */
export const validateModuleRoute = (route: ModuleRoute): boolean => {
  if (!route.path || !Array.isArray(route.children)) {
    console.error('Invalid module route structure');
    return false;
  }
  return true;
};

/**
 * Helper function to validate module menu structure
 */
export const validateModuleMenu = (menu: ModuleMenuItem): boolean => {
  if (!menu.id || !menu.title || !menu.url || !menu.icon) {
    console.error('Invalid module menu structure');
    return false;
  }
  return true;
};

/**
 * Helper function to create standard CRUD routes
 */
export const createCrudRoutes = (
  basePath: string,
  components: {
    List: React.ComponentType;
    Add: React.ComponentType;
    Edit: React.ComponentType;
    Detail: React.ComponentType;
  }
): ModuleRoute => {
  return {
    path: basePath,
    children: [
      { index: true, Component: components.List },
      { path: "add", Component: components.Add },
      { path: ":id", Component: components.Detail },
      { path: ":id/edit", Component: components.Edit },
    ]
  };
};

/**
 * Helper function to create standard module menu
 */
export const createModuleMenu = (
  id: string,
  title: string,
  basePath: string,
  icon: React.ComponentType,
  options: {
    permissions?: string | string[];
    roles?: string | string[];
    showAddItem?: boolean;
  } = {}
): ModuleMenuItem => {
  const menu: ModuleMenuItem = {
    id,
    title,
    url: basePath,
    icon,
  };

  if (options.roles) menu.roles = options.roles;
  if (options.permissions) menu.permissions = options.permissions;

  if (options.showAddItem !== false) {
    menu.items = [
      {
        id: "list",
        title: `${title} List`,
        url: basePath,
      },
      {
        id: "add",
        title: `Add ${title}`,
        url: `${basePath}/add`,
      },
    ];
  }

  return menu;
};

// Export types for module developers
// Types are already exported above with their interface declarations
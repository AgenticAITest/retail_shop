/**
 * Module Metadata Types and Utilities
 * 
 * This file defines the standard structure for module.json files
 * and provides utilities to work with module metadata.
 */

export interface ModuleMetadata {
  id: string;
  name: string;
  owner: string;
  description: string;
  version: string;
  metadata: {
    category: string;
    tags: string[];
    dependencies: {
      requires: string[];
      optional: string[];
    };
    permissions: string[];
    routes: {
      api: string;
      client: string;
    };
    database: {
      tables: string[];
      relations: string[];
    };
    features: string[];
  };
  author: {
    name: string;
    email: string;
    url: string;
  };
  repository: {
    type: string;
    url: string;
    directory: string;
  };
  license: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Load module metadata from module.json file
 */
export const loadModuleMetadata = async (modulePath: string): Promise<ModuleMetadata> => {
  try {
    const response = await fetch(`${modulePath}/module.json`);
    if (!response.ok) {
      throw new Error(`Failed to load module metadata: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error loading module metadata from ${modulePath}:`, error);
    throw error;
  }
};

/**
 * Validate module metadata structure
 */
export const validateModuleMetadata = (metadata: any): metadata is ModuleMetadata => {
  const required = ['id', 'name', 'owner', 'description', 'version'];
  
  for (const field of required) {
    if (!metadata[field]) {
      console.error(`Missing required field: ${field}`);
      return false;
    }
  }

  if (!metadata.metadata || typeof metadata.metadata !== 'object') {
    console.error('Missing or invalid metadata object');
    return false;
  }

  return true;
};

/**
 * Get module version from metadata
 */
export const getModuleVersion = (metadata: ModuleMetadata): string => {
  return metadata.version;
};

/**
 * Check if module has required dependencies
 */
export const checkModuleDependencies = (
  metadata: ModuleMetadata,
  registeredModules: string[]
): { satisfied: boolean; missing: string[] } => {
  const required = metadata.metadata.dependencies.requires;
  const missing = required.filter(dep => !registeredModules.includes(dep));
  
  return {
    satisfied: missing.length === 0,
    missing
  };
};

/**
 * Get module permissions
 */
export const getModulePermissions = (metadata: ModuleMetadata): string[] => {
  return metadata.metadata.permissions;
};

/**
 * Create a module registry entry
 */
export const createModuleRegistryEntry = (metadata: ModuleMetadata) => {
  return {
    id: metadata.id,
    name: metadata.name,
    version: metadata.version,
    owner: metadata.owner,
    description: metadata.description,
    category: metadata.metadata.category,
    tags: metadata.metadata.tags,
    apiRoute: metadata.metadata.routes.api,
    clientRoute: metadata.metadata.routes.client,
    permissions: metadata.metadata.permissions,
    dependencies: metadata.metadata.dependencies,
    features: metadata.metadata.features,
    isActive: true,
    loadedAt: new Date().toISOString()
  };
};
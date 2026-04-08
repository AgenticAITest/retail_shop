import { RouteObject } from 'react-router';
import TaxConfig from '../pages/config/TaxConfig';
import TaxConfigAdd from '../pages/config/TaxConfigAdd';

export const taxConfigurationReactRoutes = (basePath: string): RouteObject => {
  return {
    path: basePath,
    children: [
      {
        path: "config",
        children: [
          { index: true, Component: TaxConfig },
          { path: "add", Component: TaxConfigAdd },
        ]
      },
    ]
  };
};

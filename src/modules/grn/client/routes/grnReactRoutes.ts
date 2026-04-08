import { RouteObject } from 'react-router';
import Grn from '../pages/grn/Grn';
import GrnAdd from '../pages/grn/GrnAdd';
import GrnView from '../pages/grn/GrnView';

export const grnReactRoutes = (basePath: string): RouteObject => {
  return {
    path: basePath,
    children: [
      {
        path: "grn",
        children: [
          { index: true, Component: Grn },
          { path: "add", Component: GrnAdd },
          { path: ":id", Component: GrnView },
        ]
      },
    ]
  };
};

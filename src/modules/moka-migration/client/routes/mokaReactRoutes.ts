import { RouteObject } from 'react-router';
import MokaImport from '../pages/MokaImport';
import MokaHistory from '../pages/MokaHistory';

export const mokaReactRoutes = (basePath: string): RouteObject => ({
  path: basePath,
  children: [
    { path: 'import', Component: MokaImport },
    { path: 'history', Component: MokaHistory },
    { index: true, Component: MokaImport },
  ],
});

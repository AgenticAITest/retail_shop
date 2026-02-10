import { RouteObject } from 'react-router';
import CardShowcase from '../pages/CardShowcase';
import TabShowcase from '../pages/TabShowcase';
import FormShowcase from '../pages/FormShowcase';
import ChartShowcase from '../pages/ChartShowcase';

export const showcaseModuleReactRoutes = (basePath: string): RouteObject => {
  return {
    path: basePath,
    children: [
      { path: "card", Component: CardShowcase },
      { path: "tabs", Component: TabShowcase },
      { path: "form", Component: FormShowcase },
      { path: "chart", Component: ChartShowcase },
    ]
  };
};

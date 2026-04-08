import { RouteObject } from 'react-router';
import Location from '../pages/location/Location';
import LocationAdd from '../pages/location/LocationAdd';
import LocationEdit from '../pages/location/LocationEdit';
import LocationView from '../pages/location/LocationView';

export const locationManagementReactRoutes = (basePath: string): RouteObject => {
  return {
    path: basePath,
    children: [
      {
        path: "location",
        children: [
          { index: true, Component: Location },
          { path: "add", Component: LocationAdd },
          { path: ":id", Component: LocationView },
          { path: ":id/edit", Component: LocationEdit },
        ]
      },
    ]
  };
};

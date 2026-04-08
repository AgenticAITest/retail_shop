import { RouteObject } from 'react-router';
import Transfer from '../pages/transfer/Transfer';
import TransferAdd from '../pages/transfer/TransferAdd';
import TransferView from '../pages/transfer/TransferView';

export const transferReactRoutes = (basePath: string): RouteObject => {
  return {
    path: basePath,
    children: [
      {
        path: "transfer",
        children: [
          { index: true, Component: Transfer },
          { path: "add", Component: TransferAdd },
          { path: ":id", Component: TransferView },
        ]
      },
    ]
  };
};

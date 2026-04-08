import { RouteObject } from 'react-router';
import PosLayout from '../pages/pos/PosLayout';
import PosScreen from '../pages/pos/PosScreen';
import TransactionList from '../pages/transactions/TransactionList';
import TransactionView from '../pages/transactions/TransactionView';
import ShiftList from '../pages/shifts/ShiftList';
import ShiftView from '../pages/shifts/ShiftView';

// Routes inside ConsoleLayout (admin pages)
export const posConsoleReactRoutes = (basePath: string): RouteObject => {
  return {
    path: basePath,
    children: [
      {
        path: "transaction",
        children: [
          { index: true, Component: TransactionList },
          { path: ":id", Component: TransactionView },
        ]
      },
      {
        path: "shift",
        children: [
          { index: true, Component: ShiftList },
          { path: ":id", Component: ShiftView },
        ]
      },
    ]
  };
};

// Standalone POS screen route (peer to /console, no sidebar)
export const posScreenRoute: RouteObject = {
  path: "pos",
  Component: PosLayout,
  children: [
    { index: true, Component: PosScreen },
  ],
};

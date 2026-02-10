import PrintLayout from '@client/pages/PrintLayout';
import Document from "@modules/demo-module/client/pages/document/Document";
import { RouteObject } from 'react-router';
import Department from '../pages/department/Department';
import DepartmentAdd from '../pages/department/DepartmentAdd';
import DepartmentEdit from '../pages/department/DepartmentEdit';
import DepartmentView from '../pages/department/DepartmentView';
import DocumentAdd from '../pages/document/DocumentAdd';
import DocumentEdit from '../pages/document/DocumentEdit';
import DocumentImport from '../pages/document/DocumentImport';
import DocumentView from '../pages/document/DocumentView';
import DocumentViewPrint from '../pages/document/DocumentViewPrint';
import Employee from '../pages/employee/Employee';
import EmployeeAdd from '../pages/employee/EmployeeAdd';
import EmployeeEdit from '../pages/employee/EmployeeEdit';
import EmployeeView from '../pages/employee/EmployeeView';

export const demoModuleReactRoutes = (basePath: string): RouteObject => {
  return {
    path: basePath,
    children: [
      {
        path: "document",
        children: [
          { index: true, Component: Document },
          { path: "add", Component: DocumentAdd },
          { path: "import", Component: DocumentImport },
          { path: ":id", Component: DocumentView },
          { path: ":id/edit", Component: DocumentEdit },
          // Nested route dengan layout berbeda
          {
            path: ":id/print",
            Component: PrintLayout,
            children: [
              { index: true, Component: DocumentViewPrint }
            ]
          },
          { path: ":id/delete" }
        ]
      },
      {
        path: "department",
        children: [
          { index: true, Component: Department },
          { path: "add", Component: DepartmentAdd },
          { path: ":id", Component: DepartmentView },
          { path: ":id/edit", Component: DepartmentEdit },
          { path: ":id/delete" }
        ]
      },
      {
        path: "employee",
        children: [
          { index: true, Component: Employee },
          { path: "add", Component: EmployeeAdd },
          { path: ":id", Component: EmployeeView },
          { path: ":id/edit", Component: EmployeeEdit },
          { path: ":id/delete" }
        ]
      },
    ]
  };
};

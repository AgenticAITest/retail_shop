import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import Breadcrumbs, {
  createBreadcrumbItems,
  useBreadcrumbs
} from "@client/components/console/Breadcrumbs";
import { useAuth } from "@client/provider/AuthProvider";
import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import EmployeeForm from "./EmployeeForm";
import { employeeFormSchema } from "./employeeFormSchema";
import { withModuleAuthorization } from "@client/components/auth/withModuleAuthorization";

const EmployeeAdd = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const [selectedDepartment, setSelectedDepartment] = useState<{
    value: string;
    label: string;
  } | null>(null);

  const onSelectedDepartment = (params: {
    value: string;
    label: string;
  }) => {
    setSelectedDepartment(params);
  };

  // Using the enhanced breadcrumbs with React state
  const { items: breadcrumbs, updateItem } = useBreadcrumbs(
    createBreadcrumbItems([
      {
        label: "Employees",
        onClick: () => navigate("/console/modules/demo-module/employee"),
      },
      {
        label: "Add Employee",
      },
    ])
  );

  const form = useForm<z.infer<typeof employeeFormSchema>>({
    resolver: zodResolver(employeeFormSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      id: "",
      empNo: "",
      email: "",
      status: "active",
      departmentId: "",
      // bio: {
      name: "",
      birthPlace: "",
      birthDate: new Date(),
      address: "",
      gender: "male",
      // },
      skills: [
        {
          name: "",
          rating: 0,
        }
      ],
    },
  });

  function onSubmit(values: z.infer<typeof employeeFormSchema>) {
    console.log(values);

    setIsLoading(true);
    axios
      .post("/api/modules/demo-module/employee/add", {
        ...values,
      })
      .then(() => {
        //console.log("Employee created successfully");
        navigate("/console/modules/demo-module/employee");
        toast.success("Employee has been created.");
      })
      .catch((error) => {
        console.error("Error creating employee:", error);
        toast.error("Failed to create employee.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  function onCancel() {
    navigate("/console/modules/demo-module/employee");
  }

  useEffect(() => {
    //form.setValue("tenantId", user?.activeTenant.id || '');
  }, []);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Employees</h1>
        </div>
        <div className="ml-auto px-4">
          <div className="flex items-center gap-2 text-sm">
            <Breadcrumbs items={breadcrumbs} loading={isLoading} />
          </div>
        </div>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          <div className="bg-card rounded-lg border p-6 w-full">
            <EmployeeForm form={form} onSubmit={onSubmit} onCancel={onCancel} selectedDepartment={selectedDepartment} onSelectedDepartment={onSelectedDepartment} />
          </div>
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(EmployeeAdd, {
  moduleId: 'demo-module',
  moduleName: 'Demo Module'
});

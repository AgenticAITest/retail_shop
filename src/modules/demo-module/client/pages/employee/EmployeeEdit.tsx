import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import Breadcrumbs, {
  createBreadcrumbItems,
  useBreadcrumbs,
} from "@client/components/console/Breadcrumbs";
import { useAuth } from "@client/provider/AuthProvider";
import axios from "axios";
import { parse } from "date-fns";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import EmployeeForm from "./EmployeeForm";
import { employeeFormSchema } from "./employeeFormSchema";
import { withModuleAuthorization } from "@client/components/auth/withModuleAuthorization";

const EmployeeEdit = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams();
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


  const { items: breadcrumbs, updateItem: updateBreadcrumbItem } =
    useBreadcrumbs(
      createBreadcrumbItems([
        {
          label: "Employees",
          onClick: () => navigate("/console/modules/demo-module/employee"),
        },
        {
          label: "Username",
          onClick: () => navigate(`/console/modules/demo-module/employee/${id}`),
        },
        {
          label: "Edit",
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
      .put(`/api/modules/demo-module/employee/${id}/edit`, values)
      .then(() => {
        //console.log("Employee created successfully");
        navigate("/console/modules/demo-module/employee");
        toast.success("Employee has been updated.");
      })
      .catch((error) => {
        console.error("Error updating employee:", error);
        toast.error("Failed to update employee.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  function onCancel() {
    navigate(`/console/modules/demo-module/employee/${id}`);
  }

  useEffect(() => {
    const fetchEmp = async () => {
      try {
        setIsLoading(true);
        axios.get(`/api/modules/demo-module/employee/${id}`).then((response) => {
          console.log(JSON.stringify(response.data));
          form.setValue("id", response.data.id);
          form.setValue("empNo", response.data.empNo);
          form.setValue("email", response.data.email);
          form.setValue("status", response.data.status);
          form.setValue("departmentId", response.data.departmentId);
          setSelectedDepartment({
            value: response.data.departmentId,
            label: response.data.department.name,
          });
          form.setValue("name", response.data.bio.name);
          form.setValue("birthPlace", response.data.bio.birthPlace);
          form.setValue("birthDate", parse(response.data.bio.birthDate, "yyyy-MM-dd", new Date()));
          form.setValue("address", response.data.bio.address);
          form.setValue("gender", response.data.bio.gender);
          form.setValue("skills", response.data.skills);
          
          updateBreadcrumbItem(1, { label: response.data.empNo });
        });
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEmp();

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

export default withModuleAuthorization(EmployeeEdit, {
  moduleId: 'demo-module',
  moduleName: 'Demo Module'
});

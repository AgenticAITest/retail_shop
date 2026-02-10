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
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import EmployeeForm from "./EmployeeForm";
import { employeeFormSchema } from "./employeeFormSchema";

import ConfirmDialog from "@client/components/console/ConfirmDialog";
import { parse } from "date-fns";
import { withModuleAuthorization } from "@client/components/auth/withModuleAuthorization";

const EmployeeView = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams();
  const [confirmDelete, setConfirmDelete] = useState(false);

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
          label: "View Employee",
        },
      ])
    );

  const form = useForm<z.infer<typeof employeeFormSchema>>({
    resolver: zodResolver(employeeFormSchema),
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
    },
  });

  function onEdit() {
    navigate(`/console/modules/demo-module/employee/${id}/edit`);
  }

  function onDelete() {
    setConfirmDelete(true);
  }

  function onConfirmDelete() {
    axios
      .delete(`/api/modules/demo-module/employee/${id}/delete`)
      .then(() => {
        toast.success("Employee deleted successfully");
        navigate(`/console/modules/demo-module/employee`);
      })
      .catch((error) => {
        toast.error("Failed to delete employee");
      });
  }

  useEffect(() => {
    axios.get(`/api/modules/demo-module/employee/${id}`).then((response) => {
      form.setValue("id", response.data.id);
      form.setValue("name", response.data.name);
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
  }, []);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Employees</h1>
        </div>
        <div className="ml-auto px-4">
          <div className="flex items-center gap-2 text-sm">
            <Breadcrumbs items={breadcrumbs} />
          </div>
        </div>
      </header>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          <div className="bg-card rounded-lg border p-6 w-full">
            <EmployeeForm
              form={form}
              onEdit={onEdit}
              onDelete={onDelete}
              readonly={true}
              selectedDepartment={selectedDepartment}
              onSelectedDepartment={onSelectedDepartment}
            />
          </div>
        </div>
      </div>
      <ConfirmDialog
        title='Confirm Delete'
        description='This action cannot be undone. This will permanently delete the employee and remove all associated data.'
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={onConfirmDelete}
      />
    </>
  );
};

export default withModuleAuthorization(EmployeeView, {
  moduleId: 'demo-module',
  moduleName: 'Demo Module'
});

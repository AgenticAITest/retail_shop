import axios from 'axios';
import { ref } from 'process';
import { z } from 'zod';

export const employeeFormSchema = z.object({
  id: z.string().optional(),
  empNo: z.string().nonempty("Employee No is required"),
  email: z.email("Invalid email address"),
  status: z.string().nonempty("Status is required"),
  departmentId: z.string().nonempty("Department is required"),
  name: z.string().nonempty("Name is required"),
  birthPlace: z.string().nonempty("Birth Place is required"),
  birthDate: z.date().nonoptional("Birth Date is required"),
  address: z.string().nonempty("Address is required"),
  gender: z.enum(["male", "female"]).nonoptional("Gender is required"),
  skills: z.array(z.object({
    name: z.string().optional(),
    rating: z.number().optional(),
  })),
}).refine(
  async (data) => {
    // Check if the name is unique within the tenant
    try {
      const response = await axios.post('/api/modules/demo-module/employee/validate-no', data);
      return response.status == 200;
    } catch (error) {
      console.error("Error validating employee number:", error);
      return false;
    }

  },
  {
    message: "Employee number must be unique",
    path: ["empNo"],
  }
);

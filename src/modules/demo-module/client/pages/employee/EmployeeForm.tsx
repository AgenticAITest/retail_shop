import { TimePicker24h } from "@client/components/time-picker-24h";
import { Button } from "@client/components/ui/button";
import { Calendar } from "@client/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@client/components/ui/form";
import { Input } from "@client/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@client/components/ui/popover";
import { cn } from "@client/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Minus, Pencil, Plus, Save, X } from "lucide-react";
import { useFieldArray, UseFormReturn } from "react-hook-form";
import z from "zod";
import { employeeFormSchema } from "./employeeFormSchema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@client/components/ui/select";
import { useEffect, useState } from "react";
import axios from "axios";

import { AsyncPaginate } from "react-select-async-paginate";
import { Textarea } from "@client/components/ui/textarea";
import { Label } from "@client/components/ui/label";
import { Rating, RatingButton } from "@client/components/ui/shadcn-io/rating";
import { on } from "events";
import Inputmask from "inputmask";

interface EmployeeFormProps {
  form: UseFormReturn<z.infer<typeof employeeFormSchema>>;
  onSubmit?: (values: z.infer<typeof employeeFormSchema>) => void;
  onCancel?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  readonly?: boolean;
  selectedDepartment: {
    value: string,
    label: string,
  } | null,
  onSelectedDepartment: (params: {
    value: string;
    label: string;
  }) => void;
}


const EmployeeForm = ({ form, onSubmit, onCancel, onEdit, onDelete, readonly = false, selectedDepartment, onSelectedDepartment }: EmployeeFormProps) => {

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "skills",
  });

  // const customStyles = {
  //   control: (provided: any, state: { isFocused: any; }) => ({
  //     ...provided,
  //     backgroundColor: state.isFocused ? '#e6f7ff' : 'white',
  //     borderColor: state.isFocused ? '#91d5ff' : '#d9d9d9',
  //     boxShadow: state.isFocused ? '0 0 0 2px rgba(24, 144, 255, 0.2)' : 'none',
  //   }),
  //   option: (provided: any, state: { isFocused: any; isSelected: any; }) => ({
  //     ...provided,
  //     backgroundColor: state.isFocused ? '#e6f7ff' : 'white',
  //     color: state.isSelected ? '#1890ff' : 'black',
  //   }),
  //   // Add more styles for other components like menu, multiValue, etc.
  // };

  type AdditionalType = {
    page: number;
  };

  const defaultAdditional: AdditionalType = {
    page: 1,
  };

  const onChangeDepartmentId = (option: any, field: any) => {
    console.log(option);
    console.log("field", field);
    // field.onChange(option.value);
    form.setValue('departmentId', option.value);
    onSelectedDepartment(option);
  }

  const [options, setOptions] = useState<{
    value: string;
    label: string;
  }[]>([]);
  const [hasMore, setHasMore] = useState(true);
  // const [selectedDepartment, setSelectedDepartment] = React.useState<{
  //   value: string;
  //   label: string;
  // } | null>(null);

  const loadPageOptions = async (
    q: string,
    prevOptions: unknown,
    additional = defaultAdditional
  ) => {
    const { page } = additional;
    axios.get('/api/modules/demo-module/employee/ref-departments', {
      params: {
        page,
        q
      }
    })
      .then(response => {
        console.log(response.data);
        setOptions(response.data.options || []);
        setHasMore(response.data.hasMore || false);
      })
      .catch(error => {
        console.error(error);
        // throwError(error);
      })
      .finally(() => {
        // setLoading(false);
      });

    return {
      options,
      hasMore,

      additional: {
        page: page + 1,
      },
    };
  };

  useEffect(() => {
    Inputmask({
      mask: ["[A|9]{*}"],
      // jitMasking: true
    }).mask("empNo");
  }, []);

  useEffect(() => {
    form.setValue('departmentId', selectedDepartment?.value || '');
  }, [selectedDepartment]);

  return (
    <Form {...form} >
      <form onSubmit={form.handleSubmit(onSubmit ? onSubmit : () => { })} className="space-y-4">
        <FormField
          disabled={readonly}
          control={form.control}
          name="id"
          render={({ field }) => (
            <FormItem hidden>
              <FormControl >
                <Input {...field} hidden />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          disabled={readonly}
          control={form.control}
          name="empNo"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Employee No <span className="text-destructive">*</span>
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl >
                  <Input id="empNo" {...field} />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          disabled={readonly}
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Name <span className="text-destructive">*</span>
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl >
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          disabled={readonly}
          control={form.control}
          name="birthPlace"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Birth Place <span className="text-destructive">*</span>
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl >
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <FormField
          disabled={readonly}
          control={form.control}
          name="birthDate"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Birth Date <span className="text-destructive">*</span>
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">

                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        disabled={readonly}
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      captionLayout="dropdown"
                    />
                  </PopoverContent>
                </Popover>

                {/* <FormControl >
                  <Input {...field} />

                </FormControl> */}
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <FormField
          disabled={readonly}
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Address <span className="text-destructive">*</span>
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl >
                  <Textarea
                    placeholder=""
                    className="resize-none"
                    {...field}
                  />
                  {/* <Input {...field} /> */}
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <FormField
          disabled={readonly}
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Gender <span className="text-destructive">*</span>
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl>
                  {/* <Input {...field} /> */}
                  <Select onValueChange={field.onChange} value={field.value} disabled={readonly}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">male</SelectItem>
                      <SelectItem value="female">female</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <FormField
          disabled={readonly}
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Email <span className="text-destructive">*</span>
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl >
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <FormField
          disabled={readonly}
          control={form.control}
          name="departmentId"
          render={({ field }) => (
            <FormItem className="grid grid-cols-12 gap-2 items-start">
              <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                Department <span className="text-destructive">*</span>
              </FormLabel>
              <div className="col-span-12 md:col-span-10 space-y-2">
                <FormControl >
                  {/* <Input {...field} /> */}
                  <AsyncPaginate
                    // styles={customStyles}
                    isDisabled={readonly}
                    classNamePrefix={"department-select"}
                    additional={defaultAdditional}
                    value={selectedDepartment}
                    defaultOptions={true}
                    loadOptions={loadPageOptions}
                    onChange={onChangeDepartmentId}
                  />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        {/* skill form dynamic  with button add and remove skill list */}
        <div className="grid grid-cols-12 gap-2 items-start">
          <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
            Skill
          </FormLabel>

          <div className="col-span-12 md:col-span-10 space-y-2">
            {form.getValues("skills") &&
              <div>
                {fields.map((field, index) => (
                  <div key={field.id} className="flex space-x-4 items-end mb-3">
                    <FormField
                      disabled={readonly}
                      control={form.control}
                      name={`skills.${index}.name`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input className="w-full" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      disabled={readonly}
                      control={form.control}
                      name={`skills.${index}.rating`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Rating</FormLabel>
                          <FormControl>
                            {/* <Input className="w-full" type="number" {...field} 
                              min={0} max={5}
                              onChange={e => field.onChange(Number(e.target.value))} /> */}
                            <Rating 
                              readOnly={readonly}
                              value={field.value}
                              // onChange={field.onChange}
                              onValueChange={field.onChange}
                              defaultValue={3}> 
                              {Array.from({ length: 5 }).map((_, index) => (
                                <RatingButton key={index} />
                              ))}
                            </Rating>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="button" variant="destructive" onClick={() => remove(index)} hidden={readonly}>
                      <Minus />
                    </Button>
                  </div>
                ))}
              </div>
            }

            {/* check if null skills */}
            {(!form.getValues("skills") || form.getValues("skills").length === 0) && (
              <div>
                No skill.
              </div>
            )}

            <Button type="button" variant="secondary" onClick={() => append({ name: "", rating: 1 })} hidden={readonly}>
              <Plus />
            </Button>
          </div>
        </div>

        {form.getValues("id") &&
          <FormField
            disabled={readonly}
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem className="grid grid-cols-12 gap-2 items-start">
                <FormLabel className="mb-2 mt-3 col-span-12 md:col-span-2">
                  Status <span className="text-destructive">*</span>
                </FormLabel>
                <div className="col-span-12 md:col-span-10 space-y-2">
                  <FormControl>
                    {/* <Input {...field} /> */}
                    <Select onValueChange={field.onChange} value={field.value} disabled={readonly}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">active</SelectItem>
                        <SelectItem value="inactive">inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        }
        {!readonly && (
          <div className="flex gap-2 pt-2">
            <Button type="submit">
              <Save size={20} />Save
            </Button>
            <Button type="button" variant="outline" onClick={onCancel ? onCancel : () => { }}>
              <X size={20} />Cancel
            </Button>
          </div>
        )}
        {readonly && (
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onEdit ? onEdit : () => { }}>
              <Pencil size={20} />Edit
            </Button>
            <Button type="button" variant="destructive" onClick={onDelete ? onDelete : () => { }}>
              <X size={20} />Delete
            </Button>
          </div>
        )}

      </form>
    </Form>
  )
}

export default EmployeeForm
import { Button } from '@client/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@client/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@client/components/ui/form';
import { Input } from '@client/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const userSchema = z.object({
  username: z.string().min(1, { error: 'Username is required' }),
  fullName: z.string().min(1, { error: 'Full name is required' }),
  email: z.string().email({ error: 'Valid email is required' }),
  password: z.string().min(6, { error: 'Password must be at least 6 characters' }),
  roleId: z.string().min(1, { error: 'Role is required' }),
  locationIds: z.string().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

interface UserEntry {
  username: string;
  fullName: string;
  email: string;
  password: string;
  roleId: string;
  roleName: string;
  locationIds: string[];
}

interface RoleItem {
  id: string;
  name: string;
}

interface LocationItem {
  id: string;
  code: string;
  name: string;
}

interface Step4Props {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onComplete: (data: UserEntry[]) => void;
}

const Step4Users = ({ onNext, onComplete }: Step4Props) => {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema) as any,
    defaultValues: {
      username: '',
      fullName: '',
      email: '',
      password: '',
      roleId: '',
      locationIds: '',
    },
  });

  useEffect(() => {
    Promise.all([
      axios.get('/api/system/role', { params: { perPage: 100 } }),
      axios.get('/api/modules/location-management/location', {
        params: { perPage: 1000, sort: 'name', order: 'asc' },
      }),
    ])
      .then(([rolesRes, locationsRes]) => {
        const rolesData = Array.isArray(rolesRes.data)
          ? rolesRes.data
          : rolesRes.data.roles || [];
        setRoles(rolesData);

        setLocations(locationsRes.data.locations || []);
      })
      .catch(() => {
        // Fallback
      })
      .finally(() => setLoading(false));
  }, []);

  function handleAddUser(values: UserFormValues) {
    const role = roles.find((r) => r.id === values.roleId);
    const locationIdArray = values.locationIds
      ? values.locationIds.split(',').map((id) => id.trim()).filter(Boolean)
      : [];

    const entry: UserEntry = {
      username: values.username,
      fullName: values.fullName,
      email: values.email,
      password: values.password,
      roleId: values.roleId,
      roleName: role?.name || values.roleId,
      locationIds: locationIdArray,
    };

    setUsers((prev) => [...prev, entry]);
    form.reset();
    toast.success('User added to list');
  }

  function handleRemoveUser(index: number) {
    setUsers((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = users.map(({ roleName, ...rest }) => rest);
      await axios.put('/api/modules/tenant-onboarding/onboarding/step/4', {
        users: payload,
      });
      toast.success('Users saved successfully');
      onComplete(users);
      onNext();
    } catch {
      toast.error('Failed to save users');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 size={24} className="animate-spin" />
        <span className="ml-2">Loading roles and locations...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 4: Users</CardTitle>
        <CardDescription>
          Create user accounts for your team. Assign roles and location access to each user.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add User Form */}
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-4">Add New User</h3>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddUser)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. john.doe" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. John Doe" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="e.g. john@company.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Min 6 characters" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="roleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="locationIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Locations (comma-separated IDs)</FormLabel>
                      <Select
                        onValueChange={(val) => {
                          const current = field.value ? field.value.split(',').map((s) => s.trim()).filter(Boolean) : [];
                          if (!current.includes(val)) {
                            field.onChange([...current, val].join(','));
                          }
                        }}
                        value=""
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Add location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.code} - {loc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {field.value && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Selected: {field.value.split(',').filter(Boolean).length} location(s)
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="outline">
                  <Plus size={16} className="mr-2" />
                  Add to List
                </Button>
              </div>
            </form>
          </Form>
        </div>

        {/* Users Table */}
        {users.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">
              Users to Create ({users.length})
            </h3>
            <div className="bg-card overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/20 font-semibold">
                  <TableRow>
                    <TableHead className="py-2">#</TableHead>
                    <TableHead className="py-2">Username</TableHead>
                    <TableHead className="py-2">Full Name</TableHead>
                    <TableHead className="py-2">Email</TableHead>
                    <TableHead className="py-2">Role</TableHead>
                    <TableHead className="py-2">Locations</TableHead>
                    <TableHead className="py-2 w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.fullName}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.roleName}</TableCell>
                      <TableCell>{user.locationIds.length || 0}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveUser(index)}
                        >
                          <Trash2 size={14} className="text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Save */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" />
                Save & Continue
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Step4Users;

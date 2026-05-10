import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import { Button } from '@client/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@client/components/ui/dialog';
import { Input } from '@client/components/ui/input';
import { Label } from '@client/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@client/components/ui/table';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { Calendar, Clock, Mail, Play, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';

const REPORT_TYPES = [
  { value: 'revenue', label: 'Revenue Report' },
  { value: 'inventory', label: 'Inventory Report' },
  { value: 'pos', label: 'POS Report' },
  { value: 'tax', label: 'Tax (PPN) Report' },
  { value: 'procurement', label: 'Procurement Report' },
  { value: 'transfer', label: 'Transfer Report' },
];

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const scheduleFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  report_type: z.string().min(1),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  schedule_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  day_of_week: z.number().nullable().optional(),
  day_of_month: z.number().nullable().optional(),
  recipients: z.string().min(1, 'At least one recipient email is required'),
  export_format: z.enum(['csv', 'xlsx', 'pdf']),
  report_params_days: z.string().optional(),
});

type FormData = z.infer<typeof scheduleFormSchema>;

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

const ScheduledReports = () => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { register, handleSubmit, control, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: { frequency: 'daily', export_format: 'csv', schedule_time: '08:00', report_params_days: '30' },
  });

  const frequency = watch('frequency');

  const load = () => {
    setLoading(true);
    axios.get('/api/modules/report/schedule')
      .then(r => setSchedules(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { reset({ frequency: 'daily', export_format: 'csv', schedule_time: '08:00', report_params_days: '30' }); setEditId(null); setShowForm(true); };
  const openEdit = (s: any) => {
    reset({
      name: s.name,
      report_type: s.report_type,
      frequency: s.frequency,
      schedule_time: s.schedule_time,
      day_of_week: s.day_of_week,
      day_of_month: s.day_of_month,
      recipients: Array.isArray(s.recipients) ? s.recipients.join(', ') : s.recipients,
      export_format: s.export_format,
      report_params_days: String(s.report_params?.days ?? 30),
    });
    setEditId(s.id);
    setShowForm(true);
  };

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      report_type: data.report_type,
      frequency: data.frequency,
      schedule_time: data.schedule_time,
      day_of_week: data.frequency === 'weekly' ? data.day_of_week : null,
      day_of_month: data.frequency === 'monthly' ? data.day_of_month : null,
      recipients: data.recipients.split(',').map(e => e.trim()).filter(Boolean),
      export_format: data.export_format,
      report_params: { days: Number(data.report_params_days ?? 30) },
      is_active: true,
    };
    if (editId) {
      await axios.put(`/api/modules/report/schedule/${editId}`, payload);
    } else {
      await axios.post('/api/modules/report/schedule', payload);
    }
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this scheduled report?')) return;
    setDeletingId(id);
    await axios.delete(`/api/modules/report/schedule/${id}`).catch(() => {});
    setDeletingId(null);
    load();
  };

  const handleRunNow = async (id: string) => {
    setRunningId(id);
    await axios.post(`/api/modules/report/schedule/${id}/run`).catch(() => {});
    setRunningId(null);
    alert('Report queued for generation. Recipients will receive it by email shortly.');
  };

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <h1 className="text-2xl font-semibold">Scheduled Reports</h1>
        <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />New Schedule</Button>
      </header>

      <div className="px-2">
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Report</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              )}
              {!loading && schedules.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No scheduled reports. Click "New Schedule" to create one.</TableCell></TableRow>
              )}
              {schedules.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="capitalize">{s.report_type}</TableCell>
                  <TableCell className="capitalize">{s.frequency}</TableCell>
                  <TableCell><span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.schedule_time}</span></TableCell>
                  <TableCell className="uppercase text-xs">{s.export_format}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-xs">
                      <Mail className="w-3 h-3" />
                      {Array.isArray(s.recipients) ? s.recipients.length : 0} recipient(s)
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDate(s.last_run_at)}</TableCell>
                  <TableCell className="text-sm"><span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(s.next_run_at)}</span></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleRunNow(s.id)} disabled={runningId === s.id} title="Run now">
                        <Play className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)} title="Edit">Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} disabled={deletingId === s.id} className="text-destructive hover:text-destructive" title="Delete">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit' : 'New'} Scheduled Report</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input {...register('name')} placeholder="Weekly Revenue Summary" />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Report Type</Label>
                <Controller name="report_type" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select report" /></SelectTrigger>
                    <SelectContent>{REPORT_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </div>
              <div>
                <Label>Period (days)</Label>
                <Input {...register('report_params_days')} type="number" min="1" max="365" placeholder="30" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Frequency</Label>
                <Controller name="frequency" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </div>
              <div>
                <Label>Time (HH:MM)</Label>
                <Input {...register('schedule_time')} placeholder="08:00" />
                {errors.schedule_time && <p className="text-xs text-destructive mt-1">{errors.schedule_time.message}</p>}
              </div>
            </div>

            {frequency === 'weekly' && (
              <div>
                <Label>Day of Week</Label>
                <Controller name="day_of_week" control={control} render={({ field }) => (
                  <Select value={field.value != null ? String(field.value) : ''} onValueChange={v => field.onChange(Number(v))}>
                    <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
                    <SelectContent>{DAYS_OF_WEEK.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </div>
            )}

            {frequency === 'monthly' && (
              <div>
                <Label>Day of Month</Label>
                <Input {...register('day_of_month', { valueAsNumber: true })} type="number" min="1" max="31" placeholder="1" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Export Format</Label>
                <Controller name="export_format" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>

            <div>
              <Label>Recipients (comma-separated emails)</Label>
              <Input {...register('recipients')} placeholder="manager@store.com, owner@store.com" />
              {errors.recipients && <p className="text-xs text-destructive mt-1">{errors.recipients.message}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Schedule'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default withModuleAuthorization(ScheduledReports, { moduleId: 'report', moduleName: 'Reports & Analytics' });

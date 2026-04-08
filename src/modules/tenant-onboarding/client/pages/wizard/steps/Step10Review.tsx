import { Button } from '@client/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@client/components/ui/card';
import axios from 'axios';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Loader2,
  MapPin,
  Package,
  Receipt,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const REQUIRED_STEPS = [1, 3];

interface Step10Props {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  completedSteps: Set<number>;
  stepData: Record<number, any>;
  onGoToStep: (step: number) => void;
}

const Step10Review = ({ onBack, completedSteps, stepData, onGoToStep }: Step10Props) => {
  const [goingLive, setGoingLive] = useState(false);
  const [completed, setCompleted] = useState(false);

  const missingRequired = REQUIRED_STEPS.filter((s) => !completedSteps.has(s));
  const canGoLive = missingRequired.length === 0;

  async function handleGoLive() {
    if (!canGoLive) {
      toast.error('Please complete all required steps before going live');
      return;
    }

    setGoingLive(true);
    try {
      await axios.post('/api/modules/tenant-onboarding/onboarding/complete');
      toast.success('Onboarding completed! Your tenant is now live.');
      setCompleted(true);
    } catch {
      toast.error('Failed to complete onboarding');
    } finally {
      setGoingLive(false);
    }
  }

  const companyData = stepData[1];
  const locationsData = stepData[2];
  const taxData = stepData[3];
  const usersData = stepData[4];
  const importData = stepData[5];
  const approvalData = stepData[8];
  const syncData = stepData[9];

  if (completed) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-green-100 p-6 mb-6">
            <Rocket size={48} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">You are Live!</h2>
          <p className="text-muted-foreground max-w-md">
            Your tenant has been fully configured and is now operational.
            You can access all modules from the sidebar navigation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 10: Review & Go Live</CardTitle>
        <CardDescription>
          Review your configuration below. Once everything looks good, click "Go Live" to activate your tenant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warning for missing required steps */}
        {missingRequired.length > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4">
            <AlertTriangle size={20} className="text-yellow-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-yellow-800">Required steps not completed</p>
              <p className="text-sm text-yellow-700">
                You must complete the following steps before going live:
                {missingRequired.map((s) => (
                  <button
                    key={s}
                    onClick={() => onGoToStep(s)}
                    className="ml-2 underline font-medium"
                  >
                    Step {s}
                  </button>
                ))}
              </p>
            </div>
          </div>
        )}

        {/* Summary Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Company */}
          <SummaryCard
            icon={<Building2 size={20} />}
            title="Company Profile"
            step={1}
            completed={completedSteps.has(1)}
            required
            onGoToStep={onGoToStep}
          >
            {companyData ? (
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Name:</span> {companyData.businessName}</p>
                <p><span className="text-muted-foreground">NPWP:</span> {companyData.npwp}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not configured</p>
            )}
          </SummaryCard>

          {/* Locations */}
          <SummaryCard
            icon={<MapPin size={20} />}
            title="Locations"
            step={2}
            completed={completedSteps.has(2)}
            onGoToStep={onGoToStep}
          >
            {locationsData ? (
              <p className="text-sm">
                <span className="text-2xl font-bold">{Array.isArray(locationsData) ? locationsData.length : 0}</span>
                <span className="text-muted-foreground ml-1">location(s) configured</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Not configured</p>
            )}
          </SummaryCard>

          {/* Tax */}
          <SummaryCard
            icon={<Receipt size={20} />}
            title="Tax Configuration"
            step={3}
            completed={completedSteps.has(3)}
            required
            onGoToStep={onGoToStep}
          >
            {taxData ? (
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Rate:</span> {taxData.ratePercent}%</p>
                <p><span className="text-muted-foreground">Mode:</span> <span className="capitalize">{taxData.calcMode}</span></p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not configured</p>
            )}
          </SummaryCard>

          {/* Users */}
          <SummaryCard
            icon={<Users size={20} />}
            title="Users"
            step={4}
            completed={completedSteps.has(4)}
            onGoToStep={onGoToStep}
          >
            {usersData ? (
              <p className="text-sm">
                <span className="text-2xl font-bold">{Array.isArray(usersData) ? usersData.length : 0}</span>
                <span className="text-muted-foreground ml-1">user(s) configured</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Not configured</p>
            )}
          </SummaryCard>

          {/* Products */}
          <SummaryCard
            icon={<Package size={20} />}
            title="Products"
            step={5}
            completed={completedSteps.has(5)}
            onGoToStep={onGoToStep}
          >
            {importData ? (
              <p className="text-sm">
                <span className="text-2xl font-bold">{importData.imported || 0}</span>
                <span className="text-muted-foreground ml-1">product(s) imported</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Not imported</p>
            )}
          </SummaryCard>

          {/* Approval Rules */}
          <SummaryCard
            icon={<ShieldCheck size={20} />}
            title="Approval Rules"
            step={8}
            completed={completedSteps.has(8)}
            onGoToStep={onGoToStep}
          >
            {approvalData ? (
              <p className="text-sm">
                <span className="text-2xl font-bold">
                  {Array.isArray(approvalData) ? approvalData.filter((c: any) => c.required).length : 0}
                </span>
                <span className="text-muted-foreground ml-1">rule(s) configured</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Not configured</p>
            )}
          </SummaryCard>

          {/* Sync */}
          <SummaryCard
            icon={<RefreshCw size={20} />}
            title="Sync Settings"
            step={9}
            completed={completedSteps.has(9)}
            onGoToStep={onGoToStep}
          >
            {syncData ? (
              <p className="text-sm">
                <span className="text-2xl font-bold">
                  {Array.isArray(syncData) ? syncData.length : 0}
                </span>
                <span className="text-muted-foreground ml-1">location(s) configured</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Not configured</p>
            )}
          </SummaryCard>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
          <Button
            size="lg"
            onClick={handleGoLive}
            disabled={!canGoLive || goingLive}
          >
            {goingLive ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Going Live...
              </>
            ) : (
              <>
                <Rocket size={16} className="mr-2" />
                Go Live
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

interface SummaryCardProps {
  icon: React.ReactNode;
  title: string;
  step: number;
  completed: boolean;
  required?: boolean;
  onGoToStep: (step: number) => void;
  children: React.ReactNode;
}

function SummaryCard({ icon, title, step, completed, required, onGoToStep, children }: SummaryCardProps) {
  return (
    <div
      className="rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => onGoToStep(step)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h4 className="text-sm font-semibold">{title}</h4>
          {required && (
            <span className="text-xs text-destructive font-medium">Required</span>
          )}
        </div>
        {completed ? (
          <CheckCircle2 size={16} className="text-green-600" />
        ) : (
          <span className="text-xs text-muted-foreground">Pending</span>
        )}
      </div>
      {children}
    </div>
  );
}

export default Step10Review;

import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';
import { Button } from '@client/components/ui/button';
import axios from 'axios';
import { ArrowLeft, ArrowRight, Check, Loader2, SkipForward } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Step1CompanyProfile from './steps/Step1CompanyProfile';
import Step2Locations from './steps/Step2Locations';
import Step3TaxConfig from './steps/Step3TaxConfig';
import Step4Users from './steps/Step4Users';
import Step5ImportProducts from './steps/Step5ImportProducts';
import Step6ImportSuppliers from './steps/Step6ImportSuppliers';
import Step7OpeningStock from './steps/Step7OpeningStock';
import Step8ApprovalRules from './steps/Step8ApprovalRules';
import Step9SyncSettings from './steps/Step9SyncSettings';
import Step10Review from './steps/Step10Review';

interface StepStatus {
  step: number;
  title: string;
  completed: boolean;
  required: boolean;
}

interface OnboardingStatus {
  currentStep: number;
  steps: StepStatus[];
}

const STEP_LABELS = [
  'Company Profile',
  'Locations',
  'Tax Config',
  'Users',
  'Import Products',
  'Import Suppliers',
  'Opening Stock',
  'Approval Rules',
  'Sync Settings',
  'Review & Go Live',
];

const REQUIRED_STEPS = [1, 3];

const OnboardingWizard = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [stepData, setStepData] = useState<Record<number, any>>({});

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const response = await axios.get<OnboardingStatus>(
        '/api/modules/tenant-onboarding/onboarding/status'
      );
      const data = response.data;
      setCurrentStep(data.currentStep || 1);
      const completed = new Set<number>();
      (data.steps || []).forEach((s) => {
        if (s.completed) completed.add(s.step);
      });
      setCompletedSteps(completed);
    } catch {
      // If no status yet, start from step 1
      setCurrentStep(1);
    } finally {
      setLoading(false);
    }
  }

  function handleNext() {
    if (currentStep < 10) {
      setCurrentStep((prev) => prev + 1);
    }
  }

  function handleBack() {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  }

  function handleSkip() {
    handleNext();
  }

  function markStepCompleted(step: number, data?: any) {
    setCompletedSteps((prev) => new Set(prev).add(step));
    if (data) {
      setStepData((prev) => ({ ...prev, [step]: data }));
    }
  }

  function goToStep(step: number) {
    setCurrentStep(step);
  }

  const stepProps = {
    onNext: handleNext,
    onBack: handleBack,
    onSkip: handleSkip,
  };

  function renderStep() {
    switch (currentStep) {
      case 1:
        return <Step1CompanyProfile {...stepProps} onComplete={(d) => markStepCompleted(1, d)} />;
      case 2:
        return <Step2Locations {...stepProps} onComplete={(d) => markStepCompleted(2, d)} />;
      case 3:
        return <Step3TaxConfig {...stepProps} onComplete={(d) => markStepCompleted(3, d)} />;
      case 4:
        return <Step4Users {...stepProps} onComplete={(d) => markStepCompleted(4, d)} />;
      case 5:
        return <Step5ImportProducts {...stepProps} onComplete={(d) => markStepCompleted(5, d)} />;
      case 6:
        return <Step6ImportSuppliers {...stepProps} onComplete={() => markStepCompleted(6)} />;
      case 7:
        return <Step7OpeningStock {...stepProps} onComplete={() => markStepCompleted(7)} />;
      case 8:
        return <Step8ApprovalRules {...stepProps} onComplete={(d) => markStepCompleted(8, d)} />;
      case 9:
        return <Step9SyncSettings {...stepProps} onComplete={(d) => markStepCompleted(9, d)} />;
      case 10:
        return (
          <Step10Review
            {...stepProps}
            completedSteps={completedSteps}
            stepData={stepData}
            onGoToStep={goToStep}
          />
        );
      default:
        return null;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 size={24} className="animate-spin" />
        <span className="ml-2">Loading onboarding status...</span>
      </div>
    );
  }

  const isStepRequired = REQUIRED_STEPS.includes(currentStep);
  const isLastStep = currentStep === 10;

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Tenant Setup Wizard</h1>
        </div>
      </header>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-2 py-2 md:gap-6">
          {/* Progress Bar */}
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {STEP_LABELS.map((label, index) => {
              const stepNum = index + 1;
              const isCompleted = completedSteps.has(stepNum);
              const isCurrent = currentStep === stepNum;

              return (
                <React.Fragment key={stepNum}>
                  <div className="flex flex-col items-center gap-1 min-w-[80px]">
                    <button
                      onClick={() => goToStep(stepNum)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                        isCompleted
                          ? 'bg-green-600 text-white'
                          : isCurrent
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isCompleted ? <Check size={16} /> : stepNum}
                    </button>
                    <span
                      className={`text-xs text-center whitespace-nowrap ${
                        isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {stepNum < 10 && (
                    <div
                      className={`flex-1 h-0.5 min-w-[16px] mx-1 mt-[-16px] ${
                        isCompleted ? 'bg-green-600' : 'bg-muted'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Step Content */}
          <div className="min-h-[400px]">{renderStep()}</div>

          {/* Navigation Buttons */}
          {!isLastStep && (
            <div className="flex items-center justify-between border-t pt-4">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                <ArrowLeft size={16} className="mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                {!isStepRequired && (
                  <Button variant="outline" onClick={handleSkip}>
                    <SkipForward size={16} className="mr-2" />
                    Skip
                  </Button>
                )}
                <Button onClick={handleNext}>
                  Next
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default withModuleAuthorization(OnboardingWizard, {
  moduleId: 'tenant-onboarding',
  moduleName: 'Tenant Onboarding',
});

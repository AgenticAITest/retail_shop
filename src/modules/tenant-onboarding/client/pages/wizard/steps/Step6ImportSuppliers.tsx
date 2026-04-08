import { Button } from '@client/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@client/components/ui/card';
import { Info, SkipForward } from 'lucide-react';

interface Step6Props {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

const Step6ImportSuppliers = ({ onSkip, onComplete }: Step6Props) => {
  function handleSkip() {
    onComplete();
    onSkip();
  }

  return (
    <Card className="opacity-75">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-muted-foreground">
          <Info size={20} />
          Step 6: Import Suppliers
        </CardTitle>
        <CardDescription>This feature is not yet available.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Info size={32} className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">
            Coming in Phase 2
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Supplier import will be available in Phase 2. You can skip this step for now
            and add suppliers manually later through the Supplier Management module.
          </p>
          <div className="mt-6">
            <Button variant="outline" onClick={handleSkip}>
              <SkipForward size={16} className="mr-2" />
              Skip This Step
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Step6ImportSuppliers;

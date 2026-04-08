import { Button } from '@client/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@client/components/ui/card';
import { Info, SkipForward } from 'lucide-react';

interface Step7Props {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

const Step7OpeningStock = ({ onSkip, onComplete }: Step7Props) => {
  function handleSkip() {
    onComplete();
    onSkip();
  }

  return (
    <Card className="opacity-75">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-muted-foreground">
          <Info size={20} />
          Step 7: Opening Stock
        </CardTitle>
        <CardDescription>This feature is not yet available.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Info size={32} className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">
            Coming in Phase 4
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Opening stock import will be available in Phase 4. You can skip this step for now
            and adjust stock levels later through the Inventory Management module.
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

export default Step7OpeningStock;

import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@client/components/ui/alert-dialog";
import { Checkbox } from "@client/components/ui/checkbox";
import { Label } from "@client/components/ui/label";
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface ModuleConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (deleteTables: boolean) => void;
  moduleId: string;
  moduleName: string;
  action: 'enable' | 'disable';
}

const ModuleConfirmDialog: React.FC<ModuleConfirmDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  moduleId,
  moduleName,
  action
}) => {
  const [deleteTables, setDeleteTables] = useState(true); // Default to delete tables when disabling
  const [createTables, setCreateTables] = useState(true); // Default to create tables when enabling

  const handleConfirm = () => {
    if (action === 'enable') {
      onConfirm(createTables);
    } else {
      onConfirm(deleteTables);
    }
    onOpenChange(false);
    // Reset state for next use
    setDeleteTables(true);
    setCreateTables(true);
  };

  const getDialogContent = () => {
    if (action === 'enable') {
      return {
        title: 'Enable Module',
        icon: <CheckCircle className="h-6 w-6 text-green-500" />,
        description: `Are you sure you want to enable the "${moduleName}" module?`,
        details: 'This will make the module accessible to users in your tenant.',
        variant: 'default' as const
      };
    } else {
      return {
        title: 'Disable Module',
        icon: <AlertTriangle className="h-6 w-6 text-red-500" />,
        description: `Are you sure you want to disable the "${moduleName}" module?`,
        details: 'This will make the module inaccessible to users in your tenant.',
        variant: 'destructive' as const
      };
    }
  };

  const content = getDialogContent();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center space-x-3">
            {content.icon}
            <AlertDialogTitle>{content.title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3">
            <div>
              {content.description}
            </div>
            <div className="text-sm text-muted-foreground">
              {content.details}
            </div>
            
            {action === 'enable' && (
              <div className="border rounded-lg p-4 bg-green-50/50 dark:bg-green-900/20">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="create-tables"
                    checked={createTables}
                    onCheckedChange={(checked) => setCreateTables(checked as boolean)}
                  />
                  <div className="space-y-1">
                    <Label 
                      htmlFor="create-tables"
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      Create module tables and initialize data
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      This will create the necessary database tables, indexes, and seed data for the module.
                      {!createTables && ' If unchecked, only authorization will be enabled without creating database structures.'}
                    </p>
                  </div>
                </div>
                
                {!createTables && (
                  <div className="mt-3 flex items-center space-x-2 text-xs text-yellow-600 dark:text-yellow-400">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Note: Module may not function properly without its database tables.</span>
                  </div>
                )}
              </div>
            )}
            
            {action === 'disable' && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="delete-tables"
                    checked={deleteTables}
                    onCheckedChange={(checked) => setDeleteTables(checked as boolean)}
                  />
                  <div className="space-y-1">
                    <Label 
                      htmlFor="delete-tables"
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      Delete module tables and data
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      This will permanently remove all tables, indexes, and data associated with this module. 
                      {!deleteTables && ' If unchecked, the tables will be preserved and can be reused if the module is re-enabled.'}
                    </p>
                  </div>
                </div>
                
                {deleteTables && (
                  <div className="mt-3 flex items-center space-x-2 text-xs text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Warning: This action cannot be undone and will permanently delete all module data.</span>
                  </div>
                )}
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            className={content.variant === 'destructive' && deleteTables ? 
              'bg-red-600 hover:bg-red-700 focus:ring-red-600' : 
              undefined
            }
          >
            {action === 'enable' ? 
              (createTables ? 'Enable & Create Tables' : 'Enable Module Only') : 
              (deleteTables ? 'Disable & Delete Data' : 'Disable Module')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ModuleConfirmDialog;
import React from 'react';

interface DemoModuleComponentProps {
  // Add your props here
}

const DemoModuleComponent: React.FC<DemoModuleComponentProps> = (props) => {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold">Demo Module Component</h2>
      <p className="text-muted-foreground">
        This is a reusable component for Demo Module.
      </p>
    </div>
  );
};

export default DemoModuleComponent;

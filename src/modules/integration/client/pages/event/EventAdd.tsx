import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { eventApi } from '../../lib/api/eventApi';
import { EventFormData } from '../../schemas/eventSchema';
import EventForm from '../../components/forms/EventForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@client/components/ui/card';
import { Button } from '@client/components/ui/button';
import Breadcrumbs, { createBreadcrumbItems, useBreadcrumbs } from '@client/components/console/Breadcrumbs';
import { useAuth } from '@client/provider/AuthProvider';
import { toast } from 'sonner';
import { withModuleAuthorization } from '@client/components/auth/withModuleAuthorization';

const EventAdd = () => {
  const navigate = useNavigate();
  const { isAuthorized } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const { items: breadcrumbs } = useBreadcrumbs(
    createBreadcrumbItems([
      {
        label: "Events",
        href: "/console/modules/integration/event",
      },
      {
        label: "Add Event",
      },
    ])
  );

  const handleSubmit = async (data: EventFormData) => {
    try {
      setIsLoading(true);
      await eventApi.createEvent(data);
      toast.success('Webhook event created successfully');
      navigate('/console/modules/integration/event');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to create webhook event');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/console/modules/integration/event');
  };

  if (!isAuthorized(["ADMIN"], ['integration.event.create'])) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">You don't have permission to create webhook events.</p>
      </div>
    );
  }

  return (
    <div className="mx-2 space-y-6">
      <Breadcrumbs items={breadcrumbs} />
      
      {/* Header */}
      <div>
        <div>
          <h1 className="text-3xl font-bold">Add Webhook Event</h1>
          <p className="text-gray-600 mt-2">
            Create a new webhook event type that can trigger notifications
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
          <CardDescription>
            Define the webhook event name and description. The event name should follow the format: resource.action (e.g., user.created)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default withModuleAuthorization(EventAdd, {
  moduleId: 'integration',
  moduleName: 'Integration'
});
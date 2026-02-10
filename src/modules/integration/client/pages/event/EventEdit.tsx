import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { eventApi } from "../../lib/api/eventApi";
import {
  Event,
  EventFormData,
} from "../../schemas/eventSchema";
import EventForm from "../../components/forms/EventForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@client/components/ui/card";
import { Button } from "@client/components/ui/button";
import Breadcrumbs, {
  createBreadcrumbItems,
  useBreadcrumbs,
} from "@client/components/console/Breadcrumbs";
import { useAuth } from "@client/provider/AuthProvider";
import { toast } from "sonner";
import { withModuleAuthorization } from "@client/components/auth/withModuleAuthorization";

const EventEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthorized } = useAuth();
  const [webhookEvent, setWebhookEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { items: breadcrumbs } = useBreadcrumbs(
    createBreadcrumbItems([
      {
        label: "Events",
        href: "/console/modules/integration/event",
      },
      {
        label: "Edit Event",
      },
    ]),
  );

  const loadWebhookEvent = async () => {
    try {
      setLoading(true);
      const response = await eventApi.getEvent(id!);
      // Extract the data from the response if it's wrapped
      const event = response?.data || response;
      setWebhookEvent(event);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to load webhook event",
      );
      navigate("/console/modules/integration/event");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && isAuthorized(["ADMIN"], ["integration.event.edit"])) {
      loadWebhookEvent();
    } else if (!isAuthorized(["ADMIN"], ["integration.event.edit"])) {
      navigate("/console/modules/integration/event");
    }
  }, [id, isAuthorized]);

  const handleSubmit = async (data: EventFormData) => {
    try {
      setIsSubmitting(true);
      await eventApi.updateEvent(id!, data);
      toast.success("Webhook event updated successfully");
      navigate(`/console/modules/integration/event/${id}`);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to update webhook event",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(`/console/modules/integration/event/${id}`);
  };

  if (loading) {
    return (
      <div className="mx-2 space-y-6">
        <Card>
          <CardContent className="text-center py-8">
            <p>Loading webhook event...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!webhookEvent) {
    return (
      <div className="mx-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Webhook event not found.</p>
            <Button
              onClick={() => navigate("/console/modules/integration/event")}
              className="mt-4"
            >
              Back to Events
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-2 space-y-6">
      <Breadcrumbs items={breadcrumbs} />

      {/* Header */}
      <div>
        <div>
          <h1 className="text-3xl font-bold">Edit Webhook Event</h1>
          <p className="text-gray-600 mt-2">Update the webhook event details</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
          <CardDescription>
            Modify the webhook event name and description. Changes will affect
            all future webhook notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventForm
            initialData={{
              name: webhookEvent.name,
              description: webhookEvent.description,
              isActive: webhookEvent.isActive,
            }}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isSubmitting}
            isEdit={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default withModuleAuthorization(EventEdit, {
  moduleId: 'integration',
  moduleName: 'Integration'
});
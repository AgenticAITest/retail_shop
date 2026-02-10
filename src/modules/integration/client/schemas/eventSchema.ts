import { z } from 'zod';

export const eventSchema = z.object({
  name: z.string().min(1, 'Event name is required').max(100),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().default(true),
});

export type EventFormData = z.infer<typeof eventSchema>;

export interface Event {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventListResponse {
  success: boolean;
  data: Event[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface EventResponse {
  success: boolean;
  data: Event;
}

export interface EventDeleteResponse {
  success: boolean;
  message: string;
}
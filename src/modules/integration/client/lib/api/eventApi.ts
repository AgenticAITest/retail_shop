import axios from 'axios';
import { 
  Event, 
  EventFormData, 
  EventListResponse, 
  EventResponse,
  EventDeleteResponse
} from '../../schemas/eventSchema';

const BASE_URL = '/api/modules/integration/event';

export const eventApi = {
  /**
   * Get paginated list of webhook events
   */
  getEvents: async (params?: {
    page?: number;
    perPage?: number;
    isActive?: boolean;
    name?: string;
  }): Promise<EventListResponse> => {
    const response = await axios.get<EventListResponse>(BASE_URL, { params });
    return response.data;
  },

  /**
   * Get webhook event by ID
   */
  getEvent: async (id: string): Promise<EventResponse> => {
    const response = await axios.get<EventResponse>(`${BASE_URL}/${id}`);
    return response.data;
  },

  /**
   * Create new webhook event
   */
  createEvent: async (data: EventFormData): Promise<EventResponse> => {
    const response = await axios.post<EventResponse>(BASE_URL, data);
    return response.data;
  },

  /**
   * Update existing webhook event
   */
  updateEvent: async (id: string, data: EventFormData): Promise<EventResponse> => {
    const response = await axios.put<EventResponse>(`${BASE_URL}/${id}`, data);
    return response.data;
  },

  /**
   * Delete webhook event
   */
  deleteEvent: async (id: string): Promise<EventDeleteResponse> => {
    const response = await axios.delete<EventDeleteResponse>(`${BASE_URL}/${id}`);
    return response.data;
  },

  /**
   * Get all active event names (for dropdown usage)
   */
  getActiveEventNames: async (): Promise<string[]> => {
    const response = await eventApi.getEvents({ isActive: true, perPage: 100 });
    return response.data.map(event => event.name);
  },
};
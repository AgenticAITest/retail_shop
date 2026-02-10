import { RouteObject } from 'react-router';
import ApiKeyAdd from '../pages/api-key/ApiKeyAdd';
import ApiKeyDetail from '../pages/api-key/ApiKeyDetail';
import ApiKeyEdit from '../pages/api-key/ApiKeyEdit';
import ApiKeyList from '../pages/api-key/ApiKeyList';
import EventAdd from '../pages/event/EventAdd';
import EventDetail from '../pages/event/EventDetail';
import EventEdit from '../pages/event/EventEdit';
import EventList from '../pages/event/EventList';
import PartnerAdd from '../pages/partner/PartnerAdd';
import PartnerDetail from '../pages/partner/PartnerDetail';
import PartnerEdit from '../pages/partner/PartnerEdit';
import PartnerList from '../pages/partner/PartnerList';
import WebhookAdd from '../pages/webhook/WebhookAdd';
import WebhookDetail from '../pages/webhook/WebhookDetail';
import WebhookEdit from '../pages/webhook/WebhookEdit';
import WebhookList from '../pages/webhook/WebhookList';

export const integrationReactRoutes = (basePath: string): RouteObject => {
  return {
    path: basePath,
    children: [
      {
        path: "partner",
        children: [
          { index: true, Component: PartnerList },
          { path: "add", Component: PartnerAdd },
          { path: ":id", Component: PartnerDetail },
          { path: ":id/edit", Component: PartnerEdit },
          { path: ":id/delete" }
        ]
      },
      {
        path: "event",
        children: [
          { index: true, Component: EventList },
          { path: "add", Component: EventAdd },
          { path: ":id", Component: EventDetail },
          { path: ":id/edit", Component: EventEdit },
          { path: ":id/delete" }
        ]
      },
      {
        path: "api-key",
        children: [
          { index: true, Component: ApiKeyList },
          { path: "add", Component: ApiKeyAdd },
          { path: ":id", Component: ApiKeyDetail },
          { path: ":id/edit", Component: ApiKeyEdit },
          { path: ":id/delete" }
        ]
      },
      {
        path: "webhook",
        children: [
          { index: true, Component: WebhookList },
          { path: "add", Component: WebhookAdd },
          { path: ":id", Component: WebhookDetail },
          { path: ":id/edit", Component: WebhookEdit },
          { path: ":id/delete" }
        ]
      },
    ]
  };
};

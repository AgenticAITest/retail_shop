import { RouteObject } from 'react-router';
import OnboardingWizard from '../pages/wizard/OnboardingWizard';

export const tenantOnboardingReactRoutes = (basePath: string): RouteObject => ({
  path: basePath,
  children: [
    { path: "wizard", children: [{ index: true, Component: OnboardingWizard }] },
  ],
});

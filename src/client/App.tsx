import { router } from "@client/route";
import { RouterProvider } from "react-router";
import ErrorBoundary from "./components/error/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";
import AuthProvider from "./provider/AuthProvider";
import TenantProvider from "./provider/TenantProvider";
import { ThemeProvider } from "./provider/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
      <ErrorBoundary resetOnLocationChange={true}>
        <AuthProvider>
          <TenantProvider>
            <QueryClientProvider client={queryClient}>
              <RouterProvider router={router} />
            </QueryClientProvider>
          </TenantProvider>
        </AuthProvider>
        <Toaster position="top-center"/>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;



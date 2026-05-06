"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { ToastProvider } from "@/components/seu/toast";
import { DirectionProvider } from "@/i18n/i18n";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <DirectionProvider>
          <ToastProvider>{children}</ToastProvider>
        </DirectionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

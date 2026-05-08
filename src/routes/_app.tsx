import "@/assets/styles/globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Tooltip as T } from "radix-ui";
import "core-js/features/array/at";

const queryClient = new QueryClient();

export default function App({ Component, pageProps }: any) {
  return (
    <QueryClientProvider client={queryClient}>
      <T.Provider>
        <Component {...pageProps} />
      </T.Provider>
    </QueryClientProvider>
  );
}

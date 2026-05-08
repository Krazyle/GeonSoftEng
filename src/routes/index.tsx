import { StrictMode, Suspense, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Route, Switch } from "wouter";
import { AppMain } from "@/components/app_main";
import "@/assets/styles/globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { Tooltip as T } from "radix-ui";
import { UIDMap } from "@/utils/id_mapper";
import { PersistenceContext } from "@/utils/persistence/context";
import { MemPersistence } from "@/utils/persistence/memory";

const queryClient = new QueryClient();
const store = createStore();

function App() {
  const idMap = useRef(UIDMap.empty());
  return (
    <Suspense fallback={null}>
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <T.Provider>
            <Switch>
              <Route path="/">
                <Provider store={store}>
                  <PersistenceContext.Provider
                    value={new MemPersistence(idMap.current, store)}
                  >
                    <title>App</title>
                    <AppMain />
                  </PersistenceContext.Provider>
                </Provider>
              </Route>
            </Switch>
          </T.Provider>
        </QueryClientProvider>
      </StrictMode>
    </Suspense>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 2,
            retry: 1,
        },
    },
});

const enableReactQueryDevtools =
    import.meta.env.DEV && import.meta.env.VITE_REACT_QUERY_DEVTOOLS === "true";

const rootEl = document.getElementById("root");
if (!rootEl) {
    throw new Error(
        'Root element #root not found in index.html. Make sure index.html contains <div id="root"></div>',
    );
}

ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <App />
                {enableReactQueryDevtools && <ReactQueryDevtools initialIsOpen={false} />}
            </BrowserRouter>
        </QueryClientProvider>
    </React.StrictMode>,
);

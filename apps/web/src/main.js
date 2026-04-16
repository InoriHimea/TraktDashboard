import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
const rootEl = document.getElementById("root");
if (!rootEl) {
    throw new Error('Root element #root not found in index.html. Make sure index.html contains <div id="root"></div>');
}
ReactDOM.createRoot(rootEl).render(_jsx(React.StrictMode, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsxs(BrowserRouter, { children: [_jsx(App, {}), import.meta.env.DEV && (_jsx(ReactQueryDevtools, { initialIsOpen: false }))] }) }) }));
//# sourceMappingURL=main.js.map
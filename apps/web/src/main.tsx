import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import "./index.css";
import { AppShell } from "#AppShell";
import { MessagesPage } from "#pages/MessagesPage";
import { TrashPage } from "./pages/TrashPage";
import { SettingsPage } from "#pages/SettingsPage";
import { TasksPage } from "#pages/TasksPage";
import { EventsPage } from "#pages/EventsPage";
import { LoginPage } from "#pages/LoginPage";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ToastProvider } from "#components/ui/toast";
import { persistOptions, queryClient } from "#lib/query-client";
import { applyDocumentLocale } from "#lib/i18n";

applyDocumentLocale();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
    <ToastProvider position="top-center">
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<MessagesPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/trash" element={<TrashPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ToastProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
);

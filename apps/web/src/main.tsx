import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import "./index.css";
import { AppShell } from "#AppShell";
import { MessagesPage } from "#pages/MessagesPage";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ToastProvider } from "#components/ui/toast";
import { persistOptions, queryClient } from "#lib/query-client";
import { applyDocumentLocale } from "#lib/i18n";
import { lazyPage } from "#lib/lazyPage";
import { PageLoading } from "#components/PageLoading";

// The home page ships in the main bundle; every other page loads on demand.
const TrashPage = lazyPage(() => import("#pages/TrashPage"), "TrashPage");
const AuditPage = lazyPage(() => import("#pages/AuditPage"), "AuditPage");
const StatsPage = lazyPage(() => import("#pages/StatsPage"), "StatsPage");
const SettingsPage = lazyPage(() => import("#pages/SettingsPage"), "SettingsPage");
const TasksPage = lazyPage(() => import("#pages/TasksPage"), "TasksPage");
const EventsPage = lazyPage(() => import("#pages/EventsPage"), "EventsPage");
const LoginPage = lazyPage(() => import("#pages/LoginPage"), "LoginPage");

applyDocumentLocale();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
    <ToastProvider position="top-center">
    <BrowserRouter>
      <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<MessagesPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/trash" element={<TrashPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      </Suspense>
    </BrowserRouter>
    </ToastProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
);

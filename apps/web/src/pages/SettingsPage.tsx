import type { ComponentType, ReactNode } from "react";
import { useSearchParams } from "react-router";
import { BotIcon, HardDriveDownloadIcon, ShieldCheckIcon } from "lucide-react";
import { AccountsCard } from "#components/settings/accounts/AccountsCard";
import { MediaQueueCard } from "#components/settings/MediaQueueCard";
import { AllowedEmailsCard } from "#components/settings/AllowedEmailsCard";
import { BuildInfo } from "#components/settings/BuildInfo";
import { SettingsTabHeader } from "#components/settings/SettingsTabHeader";
import { Confirm } from "#components/Confirm";
import { ScrollFade } from "#components/ScrollFade";
import { Tabs, TabsList, TabsTab, TabsPanel } from "#components/ui/tabs";
import { m } from "#lib/i18n";

interface SettingsTab {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
  content: ReactNode;
}

const TABS: SettingsTab[] = [
  {
    id: "accounts",
    label: m.settings_tab_accounts(),
    icon: BotIcon,
    description: m.settings_tab_accounts_description(),
    content: <AccountsCard />,
  },
  {
    id: "media",
    label: m.settings_tab_media(),
    icon: HardDriveDownloadIcon,
    description: m.settings_tab_media_description(),
    content: <MediaQueueCard />,
  },
  {
    id: "access",
    label: m.settings_tab_access(),
    icon: ShieldCheckIcon,
    description: m.settings_tab_access_description(),
    content: <AllowedEmailsCard />,
  },
];

export function SettingsPage() {
  // The tab lives in the URL (?tab=access) so it survives reloads and can be linked.
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = TABS.some((t) => t.id === requested) ? requested! : TABS[0].id;

  return (
    <div className="compact-controls space-y-6">
      <h1 className="font-heading text-lg font-semibold">{m.nav_settings()}</h1>

      <Tabs
        value={tab}
        onValueChange={(value) => setParams({ tab: String(value) }, { replace: true })}
        className="min-w-0 gap-5"
      >
        <ScrollFade className="-mx-4 px-4">
          <TabsList>
            {TABS.map(({ id, label, icon: Icon }) => (
              <TabsTab key={id} value={id} className="max-sm:text-sm">
                <Icon className="size-3.5 sm:size-4" />
                {label}
              </TabsTab>
            ))}
          </TabsList>
        </ScrollFade>
        {TABS.map((t) => (
          <TabsPanel key={t.id} value={t.id} className="max-w-2xl space-y-4">
            <SettingsTabHeader description={t.description} />
            {t.content}
          </TabsPanel>
        ))}
      </Tabs>

      <BuildInfo />
      <Confirm />
    </div>
  );
}

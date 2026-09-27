import { ExternalLinkIcon } from "lucide-react";
import type { PlatformInfo } from "#lib/platforms";
import { m } from "#lib/i18n";

/** How to connect a bot on one platform, with a link to its console. */
export function PlatformGuide({ platform }: { platform: PlatformInfo }) {
  const Icon = platform.icon;
  return (
    <div className="space-y-1.5 rounded-lg bg-muted/50 px-3 py-2.5">
      <p className="flex items-center gap-1.5 font-medium text-xs">
        <Icon className="size-3.5" />
        {m.platform_guide_title({ platform: platform.label() })}
        <a
          href={platform.consoleUrl}
          target="_blank"
          rel="noreferrer"
          className="ms-auto inline-flex items-center gap-1 font-normal text-muted-foreground hover:text-foreground"
        >
          {m.platform_open_console()}
          <ExternalLinkIcon className="size-3" />
        </a>
      </p>
      <ol className="list-decimal space-y-1 ps-5 text-muted-foreground text-xs">
        {platform.steps.map((step, i) => (
          <li key={i}>{step()}</li>
        ))}
      </ol>
    </div>
  );
}

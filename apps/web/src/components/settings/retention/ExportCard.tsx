import { DownloadIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { ExportDialog } from "#components/export/ExportDialog";
import { platformList } from "#lib/platforms";
import { m } from "#lib/i18n";

/** A full export (per platform, or everything), e.g. for a backup. */
export function ExportCard() {
  const platforms = platformList();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.export_card_title()}</CardTitle>
        <CardDescription>{m.export_card_description()}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {platforms.map((p) => (
          <Button key={p.id} variant="outline" onClick={() => ExportDialog.call({ initial: { platforms: [p.id] } })}>
            <DownloadIcon />
            {m.export_platform({ platform: p.label() })}
          </Button>
        ))}
        {platforms.length > 1 && (
          <Button variant="outline" onClick={() => ExportDialog.call({})}>
            <DownloadIcon />
            {m.export_everything()}
          </Button>
        )}
      </CardContent>
      <ExportDialog />
    </Card>
  );
}

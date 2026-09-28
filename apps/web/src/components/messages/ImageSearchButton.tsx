import { useState } from "react";
import { ChevronDownIcon, ScanSearchIcon, LayersIcon } from "lucide-react";
import { IMAGE_SEARCH_ENGINE_NAMES } from "@stash/shared";
import { Button } from "#components/ui/button";
import { EngineIcon } from "#components/EngineIcon";
import { Group, GroupSeparator } from "#components/ui/group";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "#components/ui/menu";
import { useImageSearch } from "#hooks/useImageSearch";
import { m } from "#lib/i18n";
import { cn } from "#lib/utils";

interface Props {
  attachmentId: number;
  /** "viewer": a labelled button in the media viewer; "tile": a small overlay on a list image. */
  variant: "viewer" | "tile";
  className?: string;
}

/** Reverse image search: one click with the quick engine, or a menu of the enabled engines. */
export function ImageSearchButton({ attachmentId, variant, className }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { settings, search } = useImageSearch(attachmentId, variant === "viewer" || menuOpen);
  const { engines, quickAction, searchAll } = settings;
  if (engines.length === 0 || (variant === "tile" && !settings.onTiles)) return null;

  const quick = quickAction !== "menu" ? quickAction : null;
  const tile = variant === "tile";
  const label = quick ? m.image_search_with({ engine: IMAGE_SEARCH_ENGINE_NAMES[quick] }) : m.image_search();

  const menu = (trigger: React.ReactElement, children: React.ReactNode) => (
    <Menu open={menuOpen} onOpenChange={setMenuOpen}>
      <MenuTrigger render={trigger}>{children}</MenuTrigger>
      <MenuPopup align="end" className="min-w-44">
        <MenuGroup>
          <MenuGroupLabel>{m.image_search()}</MenuGroupLabel>
          {engines.map((engine) => (
            <MenuItem key={engine} onClick={() => search([engine])}>
              <EngineIcon engine={engine} />
              {IMAGE_SEARCH_ENGINE_NAMES[engine]}
            </MenuItem>
          ))}
        </MenuGroup>
        {searchAll && engines.length > 1 && (
          <>
            <MenuSeparator />
            <MenuItem onClick={() => search(engines)}>
              <LayersIcon />
              {m.image_search_all()}
            </MenuItem>
          </>
        )}
      </MenuPopup>
    </Menu>
  );

  if (tile) {
    const tileClass = cn(
      // Light frosted glass; brightens on hover. Hidden until the tile is hovered on desktop.
      "border-white/40 bg-white/30 text-foreground shadow-sm backdrop-blur-md backdrop-saturate-150 hover:bg-white/55 hover:shadow-md data-popup-open:bg-white/55 dark:border-white/15 dark:bg-black/20 dark:hover:bg-black/40 dark:data-popup-open:bg-black/40",
      "transition-[opacity,background-color,box-shadow] duration-200 sm:opacity-0 sm:group-hover/tile:opacity-100 sm:focus-visible:opacity-100 sm:data-popup-open:opacity-100",
      className,
    );
    return quick ? (
      <Button size="icon-xs" variant="outline" aria-label={label} title={label} className={tileClass} onClick={() => search([quick])}>
        <ScanSearchIcon />
      </Button>
    ) : (
      menu(<Button size="icon-xs" variant="outline" aria-label={label} title={label} className={tileClass} />, <ScanSearchIcon />)
    );
  }

  if (!quick) {
    return menu(
      <Button variant="outline" className={className} />,
      <>
        <ScanSearchIcon />
        {label}
        <ChevronDownIcon className="opacity-60" />
      </>,
    );
  }

  return (
    <Group className={className}>
      <Button variant="outline" onClick={() => search([quick])}>
        <ScanSearchIcon />
        {label}
      </Button>
      {(engines.length > 1 || searchAll) && <GroupSeparator />}
      {(engines.length > 1 || searchAll) &&
        menu(<Button variant="outline" size="icon" aria-label={m.image_search_more()} />, <ChevronDownIcon />)}
    </Group>
  );
}

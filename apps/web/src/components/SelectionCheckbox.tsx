import { m } from "#lib/i18n";

/** A card's selection checkbox in select mode (PickIt's): clicks don't reach the card. */
export function SelectionCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <span className="has-[:checked]:border-primary has-[:checked]:bg-primary relative inline-flex size-4.5 shrink-0 items-center justify-center rounded-[.25rem] border border-input bg-background shadow-xs/5 sm:size-4 dark:not-has-[:checked]:bg-input/32">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        onClick={(e) => e.stopPropagation()}
        aria-label={m.action_select()}
        className="peer absolute inset-0 m-0 size-full cursor-pointer opacity-0"
      />
      <svg
        aria-hidden="true"
        className="pointer-events-none size-3.5 text-primary-foreground opacity-0 peer-checked:opacity-100 sm:size-3"
        fill="none"
        height="24"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
        viewBox="0 0 24 24"
        width="24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
      </svg>
    </span>
  );
}

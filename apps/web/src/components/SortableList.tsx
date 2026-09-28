import type { ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { m } from "#lib/i18n";
import { cn } from "#lib/utils";

/**
 * The drag handle's box. Rows that can't be dragged but sit in the same list
 * put an empty <span className={HANDLE_SLOT} /> there, so everything lines up.
 */
export const HANDLE_SLOT = "flex size-5 shrink-0 items-center justify-center";

interface Props<T extends string> {
  items: T[];
  onReorder: (items: T[]) => void;
  /** One row's content; the drag handle is added before it. */
  renderItem: (item: T) => ReactNode;
  className?: string;
  itemClassName?: string;
}

/** A vertical list reordered by dragging a handle (mouse, touch, or keyboard: space, then arrows). */
export function SortableList<T extends string>({ items, onReorder, renderItem, className, itemClassName }: Props<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(items, items.indexOf(active.id as T), items.indexOf(over.id as T)));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <ul className={className}>
          {items.map((item) => (
            <SortableRow key={item} id={item} className={itemClassName}>
              {renderItem(item)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative flex items-center gap-2 bg-card", isDragging && "z-10 shadow-md", className)}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={m.sortable_drag_handle()}
        className={cn(HANDLE_SLOT, "cursor-grab touch-none rounded text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing")}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </button>
      {children}
    </li>
  );
}

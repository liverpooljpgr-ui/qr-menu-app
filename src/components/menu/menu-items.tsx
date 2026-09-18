"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GripVertical, Plus, Trash2, Image } from "lucide-react";
import { formatFileSize } from "@/lib/image-compression";

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price_minor: number;
  currency?: string;
  photo_path: string | null;
  position: number;
  is_available: boolean;
  section_id: string;
}

interface MenuItemsProps {
  items: MenuItem[];
  isLoading?: boolean;
  onAddItem?: () => void;
  onEditItem?: (item: MenuItem) => void;
  onDeleteItem?: (id: string) => void;
  onReorder?: (items: MenuItem[]) => Promise<void>;
}

function SortableItem({
  item,
  onEdit,
  onDelete,
}: {
  item: MenuItem;
  onEdit?: (item: MenuItem) => void;
  onDelete?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const price = item.price_minor ? (item.price_minor / 100).toFixed(2) : null;

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="w-5 h-5" />
        </button>

        {item.photo_path && (
          <div className="w-16 h-16 rounded border border-muted overflow-hidden flex-shrink-0 bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.photo_path}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {!item.photo_path && (
          <div className="w-16 h-16 rounded border border-muted bg-muted flex items-center justify-center flex-shrink-0">
            <Image className="w-6 h-6 text-muted-foreground" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{item.name}</p>
          {item.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {item.description}
            </p>
          )}
          {price && (
            <p className="text-sm font-semibold text-foreground">
              {item.currency || "$"}
              {price}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(item)}
            >
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

export function MenuItems({
  items,
  isLoading = false,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onReorder,
}: MenuItemsProps) {
  const [itemList, setItemList] = useState(items);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = itemList.findIndex((item) => item.id === active.id);
        const newIndex = itemList.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(itemList, oldIndex, newIndex);

        setItemList(newItems);

        if (onReorder) {
          setIsSaving(true);
          try {
            const itemsWithPosition = newItems.map((item, idx) => ({
              ...item,
              position: idx,
            }));
            await onReorder(itemsWithPosition);
          } catch (error) {
            console.error("Reorder failed:", error);
            setItemList(itemList);
          } finally {
            setIsSaving(false);
          }
        }
      }
    },
    [itemList, onReorder]
  );

  if (isLoading) {
    return <div className="text-muted-foreground">Loading items...</div>;
  }

  if (itemList.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No items in this section</p>
        {onAddItem && (
          <Button onClick={onAddItem}>
            <Plus className="w-4 h-4 mr-2" />
            Add First Item
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Items</h3>
        {onAddItem && (
          <Button onClick={onAddItem} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={itemList.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {itemList.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                onEdit={onEditItem}
                onDelete={onDeleteItem}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {isSaving && (
        <p className="text-sm text-muted-foreground text-center">
          Saving order...
        </p>
      )}
    </div>
  );
}

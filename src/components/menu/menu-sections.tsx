"use client";

import { useState, useCallback, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";

export interface MenuSection {
  id: string;
  name: string;
  menu_id: string;
  position: number;
  is_active: boolean;
}

interface MenuSectionsProps {
  sections: MenuSection[];
  selectedSectionId?: string;
  isLoading?: boolean;
  onAddSection?: () => void;
  onSelectSection?: (section: MenuSection) => void;
  onEditSection?: (section: MenuSection) => void;
  onToggleActive?: (section: MenuSection) => void;
  onDeleteSection?: (id: string) => void;
  onReorder?: (sections: MenuSection[]) => Promise<void>;
}

function SortableSection({
  section,
  isSelected,
  onSelect,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  section: MenuSection;
  isSelected?: boolean;
  onSelect?: (section: MenuSection) => void;
  onEdit?: (section: MenuSection) => void;
  onToggleActive?: (section: MenuSection) => void;
  onDelete?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={`p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer ${
          isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
        } ${section.is_active ? '' : 'opacity-60'}`}
        onClick={() => onSelect?.(section)}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <p className="font-medium truncate">{section.name}</p>
          {!section.is_active && <Badge variant="secondary">Hidden</Badge>}
        </div>

        <div className="flex gap-2">
          {onToggleActive && (
            <Button
              variant="outline"
              size="sm"
              title={section.is_active ? "Hide from published menu" : "Show in published menu"}
              aria-label={section.is_active ? "Hide section" : "Show section"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleActive(section);
              }}
            >
              {section.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
          )}
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(section)}
            >
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(section.id);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

export function MenuSections({
  sections,
  selectedSectionId,
  isLoading = false,
  onAddSection,
  onSelectSection,
  onEditSection,
  onToggleActive,
  onDeleteSection,
  onReorder,
}: MenuSectionsProps) {
  const [items, setItems] = useState(sections);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setItems(sections);
  }, [sections]);

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
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);

        setItems(newItems);

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
            setItems(items);
          } finally {
            setIsSaving(false);
          }
        }
      }
    },
    [items, onReorder]
  );

  if (isLoading) {
    return <div className="text-muted-foreground">Loading sections...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No sections yet</p>
        {onAddSection && (
          <Button onClick={onAddSection}>
            <Plus className="w-4 h-4 mr-2" />
            Add First Section
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Sections</h2>
        {onAddSection && (
          <Button onClick={onAddSection} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Section
          </Button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {items.map((section) => (
              <SortableSection
                key={section.id}
                section={section}
                isSelected={section.id === selectedSectionId}
                onSelect={onSelectSection}
                onEdit={onEditSection}
                onToggleActive={onToggleActive}
                onDelete={onDeleteSection}
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

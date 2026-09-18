"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
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
import { CornerDownRight, Eye, EyeOff, GripVertical, ListPlus, Plus, Trash2 } from "lucide-react";

export interface MenuSection {
  id: string;
  name: string;
  menu_id: string;
  position: number;
  is_active: boolean;
  parent_section_id: string | null;
}

interface MenuSectionsProps {
  sections: MenuSection[];
  selectedSectionId?: string;
  isLoading?: boolean;
  onAddSection?: () => void;
  onAddSubsection?: (parent: MenuSection) => void;
  onSelectSection?: (section: MenuSection) => void;
  onEditSection?: (section: MenuSection) => void;
  onToggleActive?: (section: MenuSection) => void;
  onDeleteSection?: (id: string) => void;
  onReorder?: (siblings: MenuSection[]) => Promise<void>;
}

const byPosition = (a: MenuSection, b: MenuSection) => a.position - b.position;

function SortableSection({
  section,
  isSelected,
  parentInactive,
  onSelect,
  onEdit,
  onAddSubsection,
  onToggleActive,
  onDelete,
}: {
  section: MenuSection;
  isSelected?: boolean;
  parentInactive?: boolean;
  onSelect?: (section: MenuSection) => void;
  onEdit?: (section: MenuSection) => void;
  onAddSubsection?: (parent: MenuSection) => void;
  onToggleActive?: (section: MenuSection) => void;
  onDelete?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });
  const isSub = section.parent_section_id !== null;
  const hidden = !section.is_active || parentInactive;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={`${isSub ? "p-3" : "p-4"} flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer ${
          isSelected ? "ring-2 ring-primary bg-primary/5" : ""
        } ${hidden ? "opacity-60" : ""}`}
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
          {isSub && <CornerDownRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
          <p className={`truncate ${isSub ? "text-sm" : "font-medium"}`}>{section.name}</p>
          {!section.is_active && <Badge variant="secondary">Hidden</Badge>}
        </div>

        <div className="flex gap-1.5">
          {!isSub && onAddSubsection && (
            <Button
              variant="outline"
              size="sm"
              title="Add subsection"
              aria-label="Add subsection"
              onClick={(e) => {
                e.stopPropagation();
                onAddSubsection(section);
              }}
            >
              <ListPlus className="w-4 h-4" />
            </Button>
          )}
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
            <Button variant="outline" size="sm" onClick={() => onEdit(section)}>
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              aria-label="Delete section"
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
  onAddSubsection,
  onSelectSection,
  onEditSection,
  onToggleActive,
  onDeleteSection,
  onReorder,
}: MenuSectionsProps) {
  const [all, setAll] = useState(sections);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAll(sections);
  }, [sections]);

  const { topLevel, childrenOf } = useMemo(() => {
    const topLevel = all.filter((s) => s.parent_section_id === null).sort(byPosition);
    const childrenOf = new Map<string, MenuSection[]>();
    for (const s of all) {
      if (s.parent_section_id === null) continue;
      const list = childrenOf.get(s.parent_section_id) ?? [];
      list.push(s);
      childrenOf.set(s.parent_section_id, list);
    }
    for (const list of childrenOf.values()) list.sort(byPosition);
    return { topLevel, childrenOf };
  }, [all]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const from = all.find((s) => s.id === active.id);
      const to = all.find((s) => s.id === over.id);
      // Only reorder among siblings; dropping onto another level is a no-op.
      if (!from || !to || from.parent_section_id !== to.parent_section_id) return;

      const siblings = all.filter((s) => s.parent_section_id === from.parent_section_id).sort(byPosition);
      const reordered = arrayMove(
        siblings,
        siblings.findIndex((s) => s.id === from.id),
        siblings.findIndex((s) => s.id === to.id)
      ).map((s, idx) => ({ ...s, position: idx }));

      const previous = all;
      const byId = new Map(reordered.map((s) => [s.id, s]));
      setAll(all.map((s) => byId.get(s.id) ?? s));

      if (onReorder) {
        setIsSaving(true);
        try {
          await onReorder(reordered);
        } catch (error) {
          console.error("Reorder failed:", error);
          setAll(previous);
        } finally {
          setIsSaving(false);
        }
      }
    },
    [all, onReorder]
  );

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

      {isLoading ? (
        <div className="text-muted-foreground">Loading sections...</div>
      ) : topLevel.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No sections yet</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={topLevel.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {topLevel.map((section) => {
                const children = childrenOf.get(section.id) ?? [];
                return (
                  <div key={section.id}>
                    <SortableSection
                      section={section}
                      isSelected={section.id === selectedSectionId}
                      onSelect={onSelectSection}
                      onEdit={onEditSection}
                      onAddSubsection={onAddSubsection}
                      onToggleActive={onToggleActive}
                      onDelete={onDeleteSection}
                    />
                    {children.length > 0 && (
                      <SortableContext
                        items={children.map((c) => c.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="ml-6 mt-2 space-y-2">
                          {children.map((child) => (
                            <SortableSection
                              key={child.id}
                              section={child}
                              isSelected={child.id === selectedSectionId}
                              parentInactive={!section.is_active}
                              onSelect={onSelectSection}
                              onEdit={onEditSection}
                              onToggleActive={onToggleActive}
                              onDelete={onDeleteSection}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    )}
                  </div>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {isSaving && (
        <p className="text-sm text-muted-foreground text-center">Saving order...</p>
      )}
    </div>
  );
}

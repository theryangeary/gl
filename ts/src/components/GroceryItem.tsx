
import { useState } from 'react';
import type { GroceryListEntry } from '../types/grocery';

interface GroceryItemProps {
  item: GroceryListEntry
  onUpdate: (id: number, updates: Partial<GroceryListEntry>) => void
  onDelete: (id: number) => void
  dragHandleProps: any
}

export default function GroceryItem({
  item,
  onUpdate,
  onDelete,
  dragHandleProps,
}: GroceryItemProps) {
  const [checked, setChecked] = useState(item.completed);

  var fullLabel = `${item.quantity} ${item.description}`
  if (item.notes.length > 0) {
    fullLabel += ` (${item.notes})`;
  }

  const handleCheckboxChange = (completed: boolean) => {
    onUpdate(item.id, { completed })
  }

  const handleDelete = () => {
    onDelete(item.id)
  }

  return (
    <div className="flex items-center gap-3 p-1 border-none border-gray-200 bg-white" >
      <div
        {...dragHandleProps}
        style={{touchAction: 'manipulation'}}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 pl-4"
        title="Drag to reorder"
      >
        ⋮⋮
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => { handleCheckboxChange(e.target.checked); setChecked(e.target.checked) } }
        className="w-4 h-4"
      />
      <div className="flex-1">
        <p>{fullLabel}</p>
      </div>
      <button
         onClick={handleDelete}
         className="text-gray-400 hover:text-red-500 text-lg leading-none pr-4"
         aria-label="Delete item"
      >
        ×
      </button>
    </div>
  )
}

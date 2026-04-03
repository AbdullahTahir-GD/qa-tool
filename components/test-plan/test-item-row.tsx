'use client'
import { useState } from 'react'
import { ChevronRight, ChevronDown, Plus, Trash2, GripVertical } from 'lucide-react'
import { PriorityBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TestItem } from '@/types'

interface TestItemRowProps {
  item: TestItem
  depth?: number
  onAddChild: (parentId: string) => void
  onDelete: (id: string) => void
  canEdit: boolean
}

export function TestItemRow({ item, depth = 0, onAddChild, onDelete, canEdit }: TestItemRowProps) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = item.children && item.children.length > 0

  return (
    <div className="animate-fade-in">
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-[8px] hover:bg-[var(--bg-elevated)] group transition-colors"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        {canEdit && (
          <GripVertical size={13} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0" />
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn('flex-shrink-0 transition-colors', hasChildren ? 'text-[var(--text-muted)]' : 'opacity-0 pointer-events-none')}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <span className="flex-1 text-sm text-[var(--text-primary)]">{item.title}</span>
        <PriorityBadge priority={item.priority} />
        {canEdit && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" onClick={() => onAddChild(item.id)} className="!p-1.5">
              <Plus size={12} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)} className="!p-1.5 hover:text-red-400">
              <Trash2 size={12} />
            </Button>
          </div>
        )}
      </div>
      {expanded && item.children?.map(child => (
        <TestItemRow
          key={child.id}
          item={child}
          depth={depth + 1}
          onAddChild={onAddChild}
          onDelete={onDelete}
          canEdit={canEdit}
        />
      ))}
    </div>
  )
}

'use client'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { Priority } from '@/types'

interface AddItemFormProps {
  parentId?: string | null
  planId: string
  onAdd: (title: string, priority: Priority, parentId: string | null) => Promise<void>
  onCancel?: () => void
  inline?: boolean
}

export function AddItemForm({ parentId = null, planId, onAdd, onCancel, inline }: AddItemFormProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    await onAdd(title.trim(), priority, parentId ?? null)
    setTitle('')
    setPriority('medium')
    setLoading(false)
    setOpen(false)
  }

  if (!open && !inline) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus size={13} />
        Add Test Case
      </Button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 p-3 rounded-[10px] border border-[var(--border)] bg-[var(--bg-elevated)] mt-2 animate-fade-in"
    >
      <Input
        placeholder="Test case title..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        autoFocus
        className="flex-1"
      />
      <Select
        value={priority}
        onChange={e => setPriority(e.target.value as Priority)}
        className="w-28"
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="critical">Critical</option>
      </Select>
      <Button type="submit" size="sm" disabled={loading || !title.trim()}>Add</Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => { setOpen(false); onCancel?.() }}
      >
        Cancel
      </Button>
    </form>
  )
}

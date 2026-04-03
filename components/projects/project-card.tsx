'use client'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { FolderKanban, ArrowRight, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Project } from '@/types'

interface ProjectCardProps {
  project: Project
  runCount?: number
  memberCount?: number
}

export function ProjectCard({ project, runCount = 0, memberCount = 0 }: ProjectCardProps) {
  const router = useRouter()
  return (
    <Card
      hover
      onClick={() => router.push(`/projects/${project.id}`)}
      className="p-5 flex flex-col gap-4 group"
    >
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-[8px] bg-accent/10 flex items-center justify-center flex-shrink-0">
          <FolderKanban size={17} className="text-accent" />
        </div>
        <ArrowRight size={14} className="text-[var(--text-muted)] group-hover:text-accent transition-colors" />
      </div>
      <div>
        <h3 className="font-semibold text-[var(--text-primary)] text-sm leading-snug">{project.name}</h3>
        {project.description && (
          <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{project.description}</p>
        )}
      </div>
      <div className="flex items-center gap-3 pt-1 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)]">
        <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
        <span>•</span>
        <span>{runCount} run{runCount !== 1 ? 's' : ''}</span>
        <span className="ml-auto flex items-center gap-1">
          <Clock size={10} />
          {formatDate(project.created_at)}
        </span>
      </div>
    </Card>
  )
}

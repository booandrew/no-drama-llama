import type { ComponentProps } from 'react'

import { SOURCE_TYPE_CONFIG, type RowType } from '@/lib/source-meta'
import { cn } from '@/lib/utils'

interface SourceBadgeProps extends ComponentProps<'span'> {
  type: RowType
  iconClassName?: string
}

export function SourceBadge({ type, className, iconClassName, ...props }: SourceBadgeProps) {
  const { fullLabel, className: colorClassName, icon: Icon } = SOURCE_TYPE_CONFIG[type]

  return (
    <span
      className={cn(
        'inline-flex h-5 items-center justify-center rounded px-1.5 py-0.5 leading-none',
        colorClassName,
        className,
      )}
      aria-label={fullLabel}
      title={fullLabel}
      {...props}
    >
      <Icon className={cn('size-3.5', iconClassName)} aria-hidden="true" />
    </span>
  )
}

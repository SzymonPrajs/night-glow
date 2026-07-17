import { useEffect, useId, useRef } from 'react'
import { Pin, PinOff, X } from 'lucide-react'

type SideDrawerProps = {
  side: 'left' | 'right'
  label: string
  tabLabel?: string
  tabIcon: React.ReactNode
  panelClass: string
  panelLabel: string
  pinned: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export default function SideDrawer({
  side,
  label,
  tabLabel = label,
  tabIcon,
  panelClass,
  panelLabel,
  pinned,
  open,
  onOpenChange,
  children,
}: SideDrawerProps) {
  const panelId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const wasExpandedRef = useRef(false)
  const expanded = pinned || open

  useEffect(() => {
    if (wasExpandedRef.current && !expanded && panelRef.current?.contains(document.activeElement)) {
      triggerRef.current?.focus()
    }
    wasExpandedRef.current = expanded
  }, [expanded])

  const supportsHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

  return (
    <section
      className={`side-drawer ${side} ${expanded ? 'is-open' : ''} ${pinned ? 'is-pinned' : ''}`}
      onMouseEnter={() => {
        if (supportsHover()) onOpenChange(true)
      }}
      onMouseLeave={(event) => {
        if (!supportsHover()) return
        const focused = event.currentTarget.ownerDocument.activeElement
        if (!pinned && !event.currentTarget.contains(focused)) onOpenChange(false)
      }}
      onBlurCapture={(event) => {
        if (!pinned && !event.currentTarget.contains(event.relatedTarget as Node | null)) onOpenChange(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && expanded && !pinned) {
          event.stopPropagation()
          onOpenChange(false)
        }
      }}
    >
      <div className="drawer-hover-strip" aria-hidden="true" />
      <button
        ref={triggerRef}
        className="drawer-tab"
        type="button"
        onClick={() => onOpenChange(!expanded)}
        aria-label={`${expanded ? 'Hide' : 'Show'} ${label}`}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        {tabIcon}
        <span>{tabLabel}</span>
      </button>
      <aside
        ref={panelRef}
        id={panelId}
        className={`glass-panel drawer-panel ${panelClass}`}
        aria-label={panelLabel}
        aria-hidden={!expanded}
      >
        {children}
      </aside>
    </section>
  )
}

type PanelHeaderProps = {
  icon: React.ReactNode
  title: string
  pinned: boolean
  onPinnedChange: (pinned: boolean) => void
  onClose: () => void
}

export function PanelHeader({ icon, title, pinned, onPinnedChange, onClose }: PanelHeaderProps) {
  return (
    <div className="panel-header">
      <div className="panel-title">{icon}<strong>{title}</strong></div>
      <div className="panel-actions">
        <button
          className={pinned ? 'pin-button active' : 'pin-button'}
          type="button"
          onClick={() => onPinnedChange(!pinned)}
          aria-label={pinned ? `Unpin ${title}` : `Pin ${title} open`}
          aria-pressed={pinned}
        >
          {pinned ? <PinOff size={17} /> : <Pin size={17} />}
        </button>
        <button type="button" onClick={onClose} aria-label={`Close ${title}`}><X size={17} /></button>
      </div>
    </div>
  )
}

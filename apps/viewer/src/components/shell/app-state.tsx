'use client'

// Low-frequency application state shared between the views and the shell.
// Views own their engines imperatively and publish only committed status,
// science labels and inspector data here. Pointer-rate state (camera, preview
// pins, GPU handles) never enters this context.
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  CoordinatorCapabilities,
  FailureInfo,
  ObserverRenderProduct,
  ObserverScenario,
  ProgressStage,
} from '../../lib/contracts/types.ts'
import { EMPTY_STATUS, type RuntimeStatus } from '../../lib/status/model.ts'

export type InspectorTab = 'products' | 'computation' | 'provenance'

export interface ScienceStatus {
  fidelity?: string
  atmosphereLabel?: string
}

export interface ResolutionReport {
  environmentSource: string
  physicsAngular: string
  renderProduct: string
  canvas: string
}

export interface InspectorData {
  scenario?: ObserverScenario
  product?: ObserverRenderProduct | null
  capabilities?: CoordinatorCapabilities | null
  stageTimings?: Partial<Record<ProgressStage, number>>
  failure?: FailureInfo | null
  resolutions?: ResolutionReport
}

interface AppState {
  runtime: RuntimeStatus
  setRuntime: (status: RuntimeStatus) => void
  science: ScienceStatus
  setScience: (science: ScienceStatus) => void
  inspectorOpen: boolean
  inspectorTab: InspectorTab
  openInspector: (tab?: InspectorTab) => void
  closeInspector: () => void
  setInspectorTab: (tab: InspectorTab) => void
  inspectorData: InspectorData | null
  setInspectorData: (data: InspectorData | null) => void
}

const AppStateContext = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [runtime, setRuntime] = useState<RuntimeStatus>(EMPTY_STATUS)
  const [science, setScience] = useState<ScienceStatus>({})
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('products')
  const [inspectorData, setInspectorData] = useState<InspectorData | null>(null)

  const openInspector = useCallback((tab?: InspectorTab) => {
    if (tab) setInspectorTab(tab)
    setInspectorOpen(true)
  }, [])
  const closeInspector = useCallback(() => setInspectorOpen(false), [])

  const value = useMemo<AppState>(
    () => ({
      runtime,
      setRuntime,
      science,
      setScience,
      inspectorOpen,
      inspectorTab,
      openInspector,
      closeInspector,
      setInspectorTab,
      inspectorData,
      setInspectorData,
    }),
    [
      runtime,
      science,
      inspectorOpen,
      inspectorTab,
      openInspector,
      closeInspector,
      inspectorData,
    ],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState(): AppState {
  const state = useContext(AppStateContext)
  if (!state) throw new Error('useAppState must be used inside <AppStateProvider>')
  return state
}

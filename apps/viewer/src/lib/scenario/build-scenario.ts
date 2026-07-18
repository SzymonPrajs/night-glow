// Builds ObserverScenario instances from committed URL state by overriding the
// observer position, requested time and Viewer-assigned scenario_revision on
// top of the pinned fixture template. Every other identity (releases, model
// revisions, budgets) stays exactly as the fixture pins it; the coordinator
// fails closed if a requested time falls outside the pinned validity.
import type { AtmospherePayload, EmissionPayload, ObserverScenario } from '../contracts/types.ts'
import type { AtmosphereRelease, EmissionRelease } from '../fixtures/client.ts'

export interface ScenarioInput {
  latitudeDeg: number
  longitudeDeg: number
  heightM: number
  requestedTimeUtc: string
  scenarioRevision: number
}

export function buildScenario(input: ScenarioInput, template: ObserverScenario): ObserverScenario {
  return {
    ...template,
    scenario_revision: input.scenarioRevision,
    observer_wgs84: {
      latitude_deg: input.latitudeDeg,
      longitude_deg: input.longitudeDeg,
      height: input.heightM,
      height_datum: 'WGS84-ellipsoid',
    },
    requested_time_utc: input.requestedTimeUtc,
    atmosphere_selection: {
      ...template.atmosphere_selection,
      // The coordinator requires requested_time_utc == selection valid time.
      valid_time_utc: input.requestedTimeUtc,
    },
  }
}

export function buildEmissionPayload(release: EmissionRelease): EmissionPayload {
  return {
    emission_release_id: release.emission_release_id,
    unit: release.unit,
    j_dnb_nw_cm2_sr: release.cells.map((cell) => cell.j_dnb_nw_cm2_sr),
    support_area_m2: release.cells.map((cell) => cell.support_area_m2),
  }
}

export function buildAtmospherePayload(release: AtmosphereRelease): AtmospherePayload {
  return {
    atmosphere_release_id: release.atmosphere_release_id,
    valid_time_utc: release.selection.valid_time_utc,
    pressure_unit: release.variables.pressure_pa.unit,
    column_count: release.shape[0] * release.shape[1],
    geometric_height_m: release.axes.geometric_height_m_above_wgs84_ellipsoid,
    pressure_pa: release.variables.pressure_pa.values,
  }
}

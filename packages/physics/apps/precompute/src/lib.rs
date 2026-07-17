//! Thin deterministic orchestration over Physics-owned fixture decoders and solver.

use nightglow_core::{ObserverScenario, PhysicsError};
use nightglow_data::{decode_environment_products, decode_physics_assets};
use nightglow_solver::{CancellationToken, solve_scenario};
use serde::Serialize;

const MANIFEST: &str = include_str!("../../../fixtures/v1/physics-data-manifest.json");
const TERRAIN: &str = include_str!("../../../fixtures/v1/surface-terrain-product.json");
const EMISSION: &str = include_str!("../../../../contracts/fixtures/v1/emission-release.json");
const ATMOSPHERE: &str = include_str!("../../../../contracts/fixtures/v1/atmosphere-release.json");
const SCENARIO: &str = include_str!("../../../../contracts/fixtures/v1/observer-scenario.json");

#[derive(Debug, PartialEq, Serialize)]
pub struct FixtureReport {
    pub report_revision: &'static str,
    pub physics_data_manifest_id: String,
    pub physics_model_revision: String,
    pub surface_terrain_product_id: String,
    pub emission_release_id: String,
    pub atmosphere_release_id: String,
    pub atmosphere_valid_time_utc: String,
    pub emission_cells: usize,
    pub directional_intensity_w_sr: f64,
    pub mean_surface_pressure_pa: f64,
    pub output_shape: [usize; 3],
    pub output_values: usize,
    pub output_unit: String,
    pub fidelity: String,
    pub limitation: &'static str,
}

pub fn build_fixture_report() -> Result<FixtureReport, PhysicsError> {
    let assets = decode_physics_assets(MANIFEST, TERRAIN)?;
    let environment = decode_environment_products(EMISSION, ATMOSPHERE)?;
    let scenario = ObserverScenario::from_json(SCENARIO)?;
    let render = solve_scenario(
        &scenario,
        &environment,
        &assets,
        &CancellationToken::default(),
        |_| {},
    )?;

    Ok(FixtureReport {
        report_revision: "physics-fixture-precompute-report-v1",
        physics_data_manifest_id: assets.manifest.physics_data_manifest_id.as_str().to_owned(),
        physics_model_revision: assets.manifest.physics_model_revision.as_str().to_owned(),
        surface_terrain_product_id: assets
            .terrain
            .surface_terrain_product_id
            .as_str()
            .to_owned(),
        emission_release_id: environment.emission_release_id.as_str().to_owned(),
        atmosphere_release_id: environment.atmosphere_release_id.as_str().to_owned(),
        atmosphere_valid_time_utc: environment.atmosphere_valid_time_utc.as_str().to_owned(),
        emission_cells: environment.directional_intensity_w_sr.len(),
        directional_intensity_w_sr: environment.directional_intensity_w_sr.iter().sum(),
        mean_surface_pressure_pa: environment.mean_surface_pressure_pa,
        output_shape: render.shape,
        output_values: render.values.len(),
        output_unit: render.unit,
        fidelity: render.fidelity,
        limitation: "synthetic contract solve only; no raw Environment archive or production accelerator was built",
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fixture_report_is_deterministic_and_consumes_independent_products() {
        let report = build_fixture_report().unwrap();
        assert_eq!(report.emission_cells, 4);
        assert_eq!(report.directional_intensity_w_sr, 70.0);
        assert_eq!(report.mean_surface_pressure_pa, 99_850.0);
        assert_eq!(report.output_shape, [2, 4, 3]);
        assert_eq!(report.output_values, 24);
        assert_eq!(report.output_unit, "W m-2 sr-1");
        assert_eq!(report.fidelity, "synthetic-contract-only");
        assert_eq!(
            serde_json::to_string(&report).unwrap(),
            serde_json::to_string(&build_fixture_report().unwrap()).unwrap()
        );
    }
}

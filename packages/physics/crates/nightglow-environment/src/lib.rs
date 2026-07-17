//! Independent conforming decoder for Environment's first language-neutral fixtures.
//!
//! Physics does not import Environment implementation crates. This adapter
//! validates the published boundary meanings and returns only Physics inputs.

use nightglow_core::{EnvironmentInputs, PhysicsError, StableId, UtcInstant};
use serde::Deserialize;

#[derive(Deserialize)]
struct EmissionRelease {
    emission_schema_revision: String,
    emission_release_id: String,
    quantity: String,
    unit: String,
    cells: Vec<EmissionCell>,
    total_directional_intensity_w_sr: f64,
}

#[derive(Deserialize)]
struct EmissionCell {
    support_area_m2: f64,
    j_dnb_nw_cm2_sr: f64,
    directional_intensity_w_sr: f64,
    coverage_status: String,
    data_validity: String,
}

#[derive(Deserialize)]
struct AtmosphereRelease {
    atmosphere_schema_revision: String,
    atmosphere_release_id: String,
    selection: AtmosphereSelection,
    axes: AtmosphereAxes,
    shape: [usize; 3],
    variables: AtmosphereVariables,
}

#[derive(Deserialize)]
struct AtmosphereSelection {
    mode: String,
    valid_time_utc: String,
}

#[derive(Deserialize)]
struct AtmosphereAxes {
    geometric_height_m_above_wgs84_ellipsoid: Vec<f64>,
    axis_order: [String; 3],
}

#[derive(Deserialize)]
struct AtmosphereVariables {
    pressure_pa: StateVariable,
}

#[derive(Deserialize)]
struct StateVariable {
    unit: String,
    values: Vec<f64>,
}

pub fn decode_environment_inputs(
    emission_json: &str,
    atmosphere_json: &str,
) -> Result<EnvironmentInputs, PhysicsError> {
    let emission: EmissionRelease =
        serde_json::from_str(emission_json).map_err(|_| PhysicsError::InvalidDescriptor)?;
    let atmosphere: AtmosphereRelease =
        serde_json::from_str(atmosphere_json).map_err(|_| PhysicsError::InvalidDescriptor)?;

    validate_emission(&emission)?;
    let mean_surface_pressure_pa = validate_atmosphere(&atmosphere)?;
    Ok(EnvironmentInputs {
        emission_release_id: StableId::new(emission.emission_release_id)?,
        atmosphere_release_id: StableId::new(atmosphere.atmosphere_release_id)?,
        atmosphere_valid_time_utc: UtcInstant::new(atmosphere.selection.valid_time_utc)?,
        directional_intensity_w_sr: emission
            .cells
            .into_iter()
            .map(|cell| cell.directional_intensity_w_sr)
            .collect(),
        mean_surface_pressure_pa,
    })
}

fn validate_emission(release: &EmissionRelease) -> Result<(), PhysicsError> {
    if release.emission_schema_revision != "emission-fixture-v1" {
        return Err(PhysicsError::IncompatibleSchema);
    }
    if release.quantity != "corrected-reference-view-DNB-band-directional-radiance"
        || release.unit != "nW cm-2 sr-1"
    {
        return Err(PhysicsError::InvalidUnitsOrCoordinates);
    }
    let mut total = 0.0;
    for cell in &release.cells {
        if cell.coverage_status.is_empty()
            || cell.data_validity.is_empty()
            || !cell.j_dnb_nw_cm2_sr.is_finite()
            || cell.j_dnb_nw_cm2_sr < 0.0
            || !cell.support_area_m2.is_finite()
            || cell.support_area_m2 <= 0.0
        {
            return Err(PhysicsError::InvalidDescriptor);
        }
        let expected = cell.j_dnb_nw_cm2_sr * 1.0e-5 * cell.support_area_m2;
        if relative_error(cell.directional_intensity_w_sr, expected) > 1.0e-12 {
            return Err(PhysicsError::IncompatibleSemantics);
        }
        total += cell.directional_intensity_w_sr;
    }
    if relative_error(total, release.total_directional_intensity_w_sr) > 1.0e-12 {
        return Err(PhysicsError::IncompatibleSemantics);
    }
    Ok(())
}

fn validate_atmosphere(release: &AtmosphereRelease) -> Result<f64, PhysicsError> {
    if release.atmosphere_schema_revision != "atmosphere-fixture-v1" {
        return Err(PhysicsError::IncompatibleSchema);
    }
    if release.selection.mode != "standard_scenario"
        || release.axes.axis_order != ["latitude", "longitude", "height"]
        || release.variables.pressure_pa.unit != "Pa"
        || release.shape[2] != release.axes.geometric_height_m_above_wgs84_ellipsoid.len()
    {
        return Err(PhysicsError::IncompatibleSemantics);
    }
    let height_count = release.shape[2];
    if release.variables.pressure_pa.values.len() != release.shape.iter().product::<usize>() {
        return Err(PhysicsError::InvalidDescriptor);
    }
    let mut total = 0.0;
    let mut count = 0usize;
    for pressure in release
        .variables
        .pressure_pa
        .values
        .chunks_exact(height_count)
    {
        if pressure
            .iter()
            .any(|value| !value.is_finite() || *value <= 0.0)
            || pressure.windows(2).any(|pair| pair[1] >= pair[0])
        {
            return Err(PhysicsError::IncompatibleSemantics);
        }
        total += pressure[0];
        count += 1;
    }
    if count == 0 {
        return Err(PhysicsError::InsufficientEvidence);
    }
    Ok(total / count as f64)
}

fn relative_error(actual: f64, expected: f64) -> f64 {
    (actual - expected).abs() / expected.abs().max(1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    const EMISSION: &str = include_str!("../../../../contracts/fixtures/v1/emission-release.json");
    const ATMOSPHERE: &str =
        include_str!("../../../../contracts/fixtures/v1/atmosphere-release.json");

    #[test]
    fn consumes_environment_fixtures_without_redefining_science() {
        let inputs = decode_environment_inputs(EMISSION, ATMOSPHERE).unwrap();
        assert_eq!(inputs.directional_intensity_w_sr.iter().sum::<f64>(), 70.0);
        assert_eq!(inputs.mean_surface_pressure_pa, 99_850.0);
    }

    #[test]
    fn rejects_changed_environment_units() {
        let corrupt = EMISSION.replace("nW cm-2 sr-1", "W m-2 sr-1");
        assert_eq!(
            decode_environment_inputs(&corrupt, ATMOSPHERE),
            Err(PhysicsError::InvalidUnitsOrCoordinates)
        );
    }
}

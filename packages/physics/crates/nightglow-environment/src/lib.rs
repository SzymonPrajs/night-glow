//! Independent conforming decoder for Environment's first language-neutral fixtures.
//!
//! Physics does not import Environment implementation crates. This adapter
//! validates the published boundary meanings and returns only Physics inputs.

use nightglow_core::{
    DataValidity, EnvironmentInputs, PhysicsError, StableId, UncertaintyStatus, UtcInstant,
};
use serde::Deserialize;
use std::collections::BTreeMap;

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

#[derive(Clone, Debug, PartialEq)]
pub struct AtmosphereFieldVolume {
    pub atmosphere_model_revision: StableId,
    pub atmosphere_release_id: StableId,
    pub source_run_id: StableId,
    pub content_license: String,
    pub selection: AtmosphereSelection,
    pub axes: AtmosphereAxes,
    pub shape: [usize; 3],
    pub variables: BTreeMap<String, AtmosphereVariable>,
    pub data_validity: DataValidity,
    pub uncertainty_status: UncertaintyStatus,
}

#[derive(Clone, Debug, PartialEq)]
pub struct AtmosphereSelection {
    pub mode: StableId,
    pub requested_time_utc: UtcInstant,
    pub valid_time_utc: UtcInstant,
    pub standard_scenario_id: StableId,
    pub interpolation_revision: StableId,
    pub downscaling_revision: StableId,
}

#[derive(Clone, Debug, PartialEq)]
pub struct AtmosphereAxes {
    pub longitude_deg_east: Vec<f64>,
    pub latitude_deg_north: Vec<f64>,
    pub geometric_height_m_above_wgs84_ellipsoid: Vec<f64>,
    pub axis_order: [String; 3],
}

#[derive(Clone, Debug, PartialEq)]
pub struct AtmosphereVariable {
    pub unit: String,
    pub wet_dry_basis: String,
    pub evidence: StableId,
    pub values: Vec<f64>,
}

#[derive(Deserialize)]
struct SerializedAtmosphereRelease {
    atmosphere_schema_revision: String,
    atmosphere_model_revision: String,
    atmosphere_release_id: String,
    source_run_id: String,
    content_license: String,
    selection: SerializedAtmosphereSelection,
    axes: SerializedAtmosphereAxes,
    shape: [usize; 3],
    variables: BTreeMap<String, SerializedAtmosphereVariable>,
    data_validity: DataValidity,
    uncertainty_status: UncertaintyStatus,
}

#[derive(Deserialize)]
struct SerializedAtmosphereSelection {
    mode: String,
    requested_time_utc: String,
    valid_time_utc: String,
    standard_scenario_id: String,
    interpolation_revision: String,
    downscaling_revision: String,
}

#[derive(Deserialize)]
struct SerializedAtmosphereAxes {
    longitude_deg_east: Vec<f64>,
    latitude_deg_north: Vec<f64>,
    geometric_height_m_above_wgs84_ellipsoid: Vec<f64>,
    axis_order: [String; 3],
}

#[derive(Deserialize)]
struct SerializedAtmosphereVariable {
    unit: String,
    wet_dry_basis: String,
    evidence: String,
    values: Vec<f64>,
}

pub trait AtmosphereFieldProvider {
    /// Resolves an immutable field volume by exact release and valid-time identity.
    ///
    /// # Errors
    ///
    /// Returns [`PhysicsError::InsufficientEvidence`] when the provider does not
    /// contain the requested immutable identity.
    fn resolve(
        &self,
        release_id: &StableId,
        valid_time_utc: &UtcInstant,
    ) -> Result<&AtmosphereFieldVolume, PhysicsError>;
}

#[derive(Clone, Debug, PartialEq)]
pub struct FixtureAtmosphereFieldProvider {
    volume: AtmosphereFieldVolume,
}

impl FixtureAtmosphereFieldProvider {
    /// Builds the bounded provider from the language-neutral fixture.
    ///
    /// # Errors
    ///
    /// Returns a structured Physics boundary error when syntax, schema,
    /// coordinates, units, evidence, or wet/dry semantics are invalid.
    pub fn from_json(json: &str) -> Result<Self, PhysicsError> {
        let serialized: SerializedAtmosphereRelease =
            serde_json::from_str(json).map_err(|_| PhysicsError::InvalidDescriptor)?;
        let volume = AtmosphereFieldVolume::try_from(serialized)?;
        validate_atmosphere(&volume)?;
        Ok(Self { volume })
    }

    #[must_use]
    pub fn volume(&self) -> &AtmosphereFieldVolume {
        &self.volume
    }
}

impl AtmosphereFieldProvider for FixtureAtmosphereFieldProvider {
    fn resolve(
        &self,
        release_id: &StableId,
        valid_time_utc: &UtcInstant,
    ) -> Result<&AtmosphereFieldVolume, PhysicsError> {
        if &self.volume.atmosphere_release_id != release_id
            || &self.volume.selection.valid_time_utc != valid_time_utc
        {
            return Err(PhysicsError::InsufficientEvidence);
        }
        Ok(&self.volume)
    }
}

impl TryFrom<SerializedAtmosphereRelease> for AtmosphereFieldVolume {
    type Error = PhysicsError;

    fn try_from(value: SerializedAtmosphereRelease) -> Result<Self, Self::Error> {
        if value.atmosphere_schema_revision != "atmosphere-fixture-v1" {
            return Err(PhysicsError::IncompatibleSchema);
        }
        let selection = AtmosphereSelection {
            mode: StableId::new(value.selection.mode)?,
            requested_time_utc: UtcInstant::new(value.selection.requested_time_utc)?,
            valid_time_utc: UtcInstant::new(value.selection.valid_time_utc)?,
            standard_scenario_id: StableId::new(value.selection.standard_scenario_id)?,
            interpolation_revision: StableId::new(value.selection.interpolation_revision)?,
            downscaling_revision: StableId::new(value.selection.downscaling_revision)?,
        };
        let variables = value
            .variables
            .into_iter()
            .map(|(name, variable)| {
                Ok((
                    name,
                    AtmosphereVariable {
                        unit: variable.unit,
                        wet_dry_basis: variable.wet_dry_basis,
                        evidence: StableId::new(variable.evidence)?,
                        values: variable.values,
                    },
                ))
            })
            .collect::<Result<BTreeMap<_, _>, PhysicsError>>()?;
        Ok(Self {
            atmosphere_model_revision: StableId::new(value.atmosphere_model_revision)?,
            atmosphere_release_id: StableId::new(value.atmosphere_release_id)?,
            source_run_id: StableId::new(value.source_run_id)?,
            content_license: value.content_license,
            selection,
            axes: AtmosphereAxes {
                longitude_deg_east: value.axes.longitude_deg_east,
                latitude_deg_north: value.axes.latitude_deg_north,
                geometric_height_m_above_wgs84_ellipsoid: value
                    .axes
                    .geometric_height_m_above_wgs84_ellipsoid,
                axis_order: value.axes.axis_order,
            },
            shape: value.shape,
            variables,
            data_validity: value.data_validity,
            uncertainty_status: value.uncertainty_status,
        })
    }
}

pub fn decode_environment_inputs(
    emission_json: &str,
    atmosphere_json: &str,
) -> Result<EnvironmentInputs, PhysicsError> {
    let emission: EmissionRelease =
        serde_json::from_str(emission_json).map_err(|_| PhysicsError::InvalidDescriptor)?;
    let atmosphere_provider = FixtureAtmosphereFieldProvider::from_json(atmosphere_json)?;
    let atmosphere = atmosphere_provider.volume();

    validate_emission(&emission)?;
    let mean_surface_pressure_pa = mean_surface_pressure(atmosphere)?;
    Ok(EnvironmentInputs {
        emission_release_id: StableId::new(emission.emission_release_id)?,
        atmosphere_release_id: atmosphere.atmosphere_release_id.clone(),
        atmosphere_valid_time_utc: atmosphere.selection.valid_time_utc.clone(),
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

fn validate_atmosphere(release: &AtmosphereFieldVolume) -> Result<(), PhysicsError> {
    if release.selection.mode != "standard_scenario"
        || release.selection.requested_time_utc != release.selection.valid_time_utc
        || release.axes.axis_order != ["latitude", "longitude", "height"]
        || release.content_license != "CC0-1.0"
        || release.data_validity != DataValidity::Valid
    {
        return Err(PhysicsError::IncompatibleSemantics);
    }
    if release.shape
        != [
            release.axes.latitude_deg_north.len(),
            release.axes.longitude_deg_east.len(),
            release.axes.geometric_height_m_above_wgs84_ellipsoid.len(),
        ]
        || release.shape.contains(&0)
        || !strictly_increasing(&release.axes.latitude_deg_north)
        || !strictly_increasing(&release.axes.longitude_deg_east)
        || !strictly_increasing(&release.axes.geometric_height_m_above_wgs84_ellipsoid)
        || release
            .axes
            .latitude_deg_north
            .iter()
            .any(|value| !(-90.0..=90.0).contains(value))
        || release
            .axes
            .longitude_deg_east
            .iter()
            .any(|value| !(-180.0..=180.0).contains(value))
    {
        return Err(PhysicsError::InvalidUnitsOrCoordinates);
    }
    let value_count = release.shape.iter().product::<usize>();
    if release.variables.values().any(|variable| {
        variable.values.len() != value_count
            || variable.values.iter().any(|value| !value.is_finite())
    }) {
        return Err(PhysicsError::InvalidDescriptor);
    }
    validate_variable(release, "pressure_pa", "Pa", "not-applicable")?;
    validate_variable(release, "temperature_k", "K", "not-applicable")?;
    validate_variable(
        release,
        "relative_humidity_fraction",
        "1",
        "ambient-wet-state",
    )?;
    let relative_humidity = &release.variables["relative_humidity_fraction"];
    if relative_humidity
        .values
        .iter()
        .any(|value| !(0.0..=1.0).contains(value))
    {
        return Err(PhysicsError::IncompatibleSemantics);
    }
    mean_surface_pressure(release).map(|_| ())
}

fn validate_variable(
    release: &AtmosphereFieldVolume,
    name: &str,
    unit: &str,
    wet_dry_basis: &str,
) -> Result<(), PhysicsError> {
    let variable = release
        .variables
        .get(name)
        .ok_or(PhysicsError::InsufficientEvidence)?;
    if variable.unit != unit || variable.wet_dry_basis != wet_dry_basis {
        return Err(PhysicsError::InvalidUnitsOrCoordinates);
    }
    Ok(())
}

fn mean_surface_pressure(release: &AtmosphereFieldVolume) -> Result<f64, PhysicsError> {
    let pressure_values = &release
        .variables
        .get("pressure_pa")
        .ok_or(PhysicsError::InsufficientEvidence)?
        .values;
    let height_count = release.shape[2];
    let mut total = 0.0;
    let mut count = 0usize;
    for pressure in pressure_values.chunks_exact(height_count) {
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

fn strictly_increasing(values: &[f64]) -> bool {
    !values.is_empty()
        && values.iter().all(|value| value.is_finite())
        && values.windows(2).all(|pair| pair[1] > pair[0])
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
    fn provider_preserves_the_complete_atmosphere_boundary() {
        let provider = FixtureAtmosphereFieldProvider::from_json(ATMOSPHERE).unwrap();
        let volume = provider.volume();
        assert_eq!(volume.shape, [2, 2, 3]);
        assert_eq!(volume.variables.len(), 3);
        assert_eq!(volume.variables["temperature_k"].values[0], 275.0);
        assert_eq!(
            volume.variables["relative_humidity_fraction"].wet_dry_basis,
            "ambient-wet-state"
        );
        assert_eq!(
            volume.selection.standard_scenario_id,
            "clear-winter-layered-v1"
        );
        assert_eq!(
            volume.uncertainty_status,
            UncertaintyStatus::SyntheticNotStatistical
        );
    }

    #[test]
    fn provider_resolves_only_the_pinned_release_and_valid_time() {
        let provider = FixtureAtmosphereFieldProvider::from_json(ATMOSPHERE).unwrap();
        let release = StableId::new("atmosphere:fixture:central-poland-2x2x3:v1").unwrap();
        let time = UtcInstant::new("2024-01-15T00:00:00Z").unwrap();
        assert_eq!(provider.resolve(&release, &time).unwrap().shape, [2, 2, 3]);
        assert_eq!(
            provider.resolve(
                &StableId::new("atmosphere:fixture:other:v1").unwrap(),
                &time
            ),
            Err(PhysicsError::InsufficientEvidence)
        );
    }

    #[test]
    fn rejects_hidden_humidity_basis_drift() {
        let corrupt = ATMOSPHERE.replace("ambient-wet-state", "dry-aerosol-state");
        assert_eq!(
            FixtureAtmosphereFieldProvider::from_json(&corrupt),
            Err(PhysicsError::InvalidUnitsOrCoordinates)
        );
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

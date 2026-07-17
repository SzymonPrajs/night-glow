//! Shared typed quantities for native and Wasm Physics targets.

use serde::{Deserialize, Deserializer, Serialize};
use std::fmt;

#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(transparent)]
pub struct StableId(String);

impl StableId {
    pub fn new(value: impl Into<String>) -> Result<Self, PhysicsError> {
        let value = value.into();
        if value.is_empty()
            || value.len() > 256
            || !value
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || b":-._".contains(&byte))
        {
            return Err(PhysicsError::InvalidDescriptor);
        }
        Ok(Self(value))
    }

    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for StableId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(formatter)
    }
}

impl<'de> Deserialize<'de> for StableId {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        Self::new(value).map_err(serde::de::Error::custom)
    }
}

impl PartialEq<&str> for StableId {
    fn eq(&self, other: &&str) -> bool {
        self.0 == *other
    }
}

#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(transparent)]
pub struct UtcInstant(String);

impl UtcInstant {
    pub fn new(value: impl Into<String>) -> Result<Self, PhysicsError> {
        let value = value.into();
        let bytes = value.as_bytes();
        if bytes.len() < 20
            || !value.ends_with('Z')
            || bytes.get(4) != Some(&b'-')
            || bytes.get(7) != Some(&b'-')
            || bytes.get(10) != Some(&b'T')
            || bytes.get(13) != Some(&b':')
            || bytes.get(16) != Some(&b':')
        {
            return Err(PhysicsError::InvalidUnitsOrCoordinates);
        }
        Ok(Self(value))
    }

    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for UtcInstant {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(formatter)
    }
}

impl<'de> Deserialize<'de> for UtcInstant {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        Self::new(value).map_err(serde::de::Error::custom)
    }
}

impl PartialEq<&str> for UtcInstant {
    fn eq(&self, other: &&str) -> bool {
        self.0 == *other
    }
}

/// Extinction coefficient in reciprocal metres.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ExtinctionPerMetre(pub f64);

/// Geometric path length in metres.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PathLengthMetres(pub f64);

/// Dimensionless optical depth.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct OpticalDepth(pub f64);

pub const OBSERVER_PRODUCT_VALUE_COUNT: usize = 24;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ObserverScenario {
    pub observer_scenario_schema_revision: StableId,
    pub scenario_revision: u64,
    pub observer_wgs84: ObserverLocation,
    pub requested_time_utc: UtcInstant,
    pub astronomy_time_data_ids: AstronomyTimeDataIds,
    pub emission_release_id: StableId,
    pub emission_time_context: StableId,
    pub emission_scenario_policy_id: StableId,
    pub atmosphere_release_id: StableId,
    pub atmosphere_selection: ScenarioAtmosphereSelection,
    pub physics_model_revision: StableId,
    pub physics_data_manifest_id: StableId,
    pub atmosphere_optics_model_revision: StableId,
    pub surface_terrain_product_id: StableId,
    pub output: ObserverOutputRequest,
    pub resource_budget: ResourceBudget,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct AstronomyTimeDataIds {
    pub earth_orientation: StableId,
    pub leap_seconds: StableId,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ObserverLocation {
    pub latitude_deg: f64,
    pub longitude_deg: f64,
    pub height: f64,
    pub height_datum: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ScenarioAtmosphereSelection {
    pub mode: String,
    pub valid_time_utc: UtcInstant,
    pub standard_scenario_id: StableId,
    pub interpolation_revision: StableId,
    pub downscaling_revision: StableId,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ObserverOutputRequest {
    pub projection: String,
    pub azimuth_samples: usize,
    pub elevation_samples: usize,
    pub spectral_response: String,
    pub quality_tier: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ResourceBudget {
    pub wall_time_ms: u64,
    pub memory_bytes: usize,
}

impl ObserverScenario {
    pub fn from_json(json: &str) -> Result<Self, PhysicsError> {
        let scenario: Self =
            serde_json::from_str(json).map_err(|_| PhysicsError::InvalidDescriptor)?;
        scenario.validate()?;
        Ok(scenario)
    }

    pub fn validate(&self) -> Result<(), PhysicsError> {
        if self.observer_scenario_schema_revision != "observer-scenario-fixture-v1" {
            return Err(PhysicsError::IncompatibleSchema);
        }
        if self.observer_wgs84.height_datum != "WGS84-ellipsoid"
            || !(-90.0..=90.0).contains(&self.observer_wgs84.latitude_deg)
            || !(-180.0..=180.0).contains(&self.observer_wgs84.longitude_deg)
        {
            return Err(PhysicsError::InvalidUnitsOrCoordinates);
        }
        if self.output.projection != "azimuth-elevation-equirectangular"
            || self.output.azimuth_samples * self.output.elevation_samples * 3
                != OBSERVER_PRODUCT_VALUE_COUNT
        {
            return Err(PhysicsError::IncompatibleSemantics);
        }
        if self.requested_time_utc != self.atmosphere_selection.valid_time_utc {
            return Err(PhysicsError::IncompatibleSemantics);
        }
        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct ResolvedAstronomyTime {
    pub requested_time_utc: UtcInstant,
    pub earth_orientation_id: StableId,
    pub leap_seconds_id: StableId,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct PhysicsDataManifest {
    pub physics_data_manifest_schema_revision: StableId,
    pub physics_data_manifest_id: StableId,
    pub physics_model_revision: StableId,
    pub response_basis_revision: StableId,
    pub surface_terrain_product_id: StableId,
    pub reference_directional_intensity_w_sr: f64,
    pub reference_surface_pressure_pa: f64,
    pub surface_extinction_per_m_at_reference_pressure: f64,
    pub scale_height_m: f64,
    pub path_length_m: f64,
    pub shape: [usize; 3],
    pub response_basis_linear_rgb: Vec<f64>,
}

impl PhysicsDataManifest {
    pub fn from_json(json: &str) -> Result<Self, PhysicsError> {
        let manifest: Self =
            serde_json::from_str(json).map_err(|_| PhysicsError::InvalidDescriptor)?;
        manifest.validate()?;
        Ok(manifest)
    }

    pub fn validate(&self) -> Result<(), PhysicsError> {
        if self.physics_data_manifest_schema_revision != "physics-data-manifest-fixture-v1" {
            return Err(PhysicsError::IncompatibleSchema);
        }
        if self.shape.iter().product::<usize>() != OBSERVER_PRODUCT_VALUE_COUNT
            || self.response_basis_linear_rgb.len() != OBSERVER_PRODUCT_VALUE_COUNT
            || self
                .response_basis_linear_rgb
                .iter()
                .any(|value| !value.is_finite() || *value < 0.0)
            || self.reference_directional_intensity_w_sr <= 0.0
            || self.reference_surface_pressure_pa <= 0.0
            || self.surface_extinction_per_m_at_reference_pressure < 0.0
            || self.scale_height_m <= 0.0
            || self.path_length_m <= 0.0
        {
            return Err(PhysicsError::InvalidDescriptor);
        }
        Ok(())
    }

    #[must_use]
    pub fn first_slice_fixture() -> Self {
        Self {
            physics_data_manifest_schema_revision: StableId::new(
                "physics-data-manifest-fixture-v1",
            )
            .unwrap(),
            physics_data_manifest_id: StableId::new("physics-data:fixture:v1").unwrap(),
            physics_model_revision: StableId::new("fixture-single-scatter-scalar-v1").unwrap(),
            response_basis_revision: StableId::new("fixture-reference-response-v1").unwrap(),
            surface_terrain_product_id: StableId::new("surface-terrain:fixture-flat-lambertian:v1")
                .unwrap(),
            reference_directional_intensity_w_sr: 70.0,
            reference_surface_pressure_pa: 99_850.0,
            surface_extinction_per_m_at_reference_pressure: 1.2e-4,
            scale_height_m: 8_000.0,
            path_length_m: 60_000.0,
            shape: [2, 4, 3],
            response_basis_linear_rgb: FIRST_SLICE_RESPONSE_BASIS.to_vec(),
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct SurfaceTerrainProduct {
    pub surface_terrain_product_schema_revision: StableId,
    pub surface_terrain_product_id: StableId,
    pub content_license: String,
    pub height_datum: String,
    pub terrain_height_m: f64,
    pub surface_normal_enu: [f64; 3],
    pub brdf_model: String,
    pub diffuse_albedo: f64,
    pub data_validity: DataValidity,
}

impl SurfaceTerrainProduct {
    pub fn from_json(json: &str) -> Result<Self, PhysicsError> {
        let product: Self =
            serde_json::from_str(json).map_err(|_| PhysicsError::InvalidDescriptor)?;
        product.validate()?;
        Ok(product)
    }

    pub fn validate(&self) -> Result<(), PhysicsError> {
        if self.surface_terrain_product_schema_revision != "surface-terrain-fixture-v1" {
            return Err(PhysicsError::IncompatibleSchema);
        }
        if self.height_datum != "WGS84-ellipsoid"
            || self.brdf_model != "lambertian"
            || self.data_validity != DataValidity::Valid
            || !(0.0..=1.0).contains(&self.diffuse_albedo)
            || self.surface_normal_enu != [0.0, 0.0, 1.0]
            || !self.terrain_height_m.is_finite()
        {
            return Err(PhysicsError::InvalidUnitsOrCoordinates);
        }
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ArtificialLightBoundarySource {
    pub total_directional_intensity_w_sr: f64,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct OpticalAtmosphereState {
    pub mean_surface_pressure_pa: f64,
}

pub const FIRST_SLICE_RESPONSE_BASIS: [f64; OBSERVER_PRODUCT_VALUE_COUNT] = [
    0.000001, 0.0000008, 0.0000005, 0.0000012, 0.0000009, 0.00000055, 0.0000014, 0.000001,
    0.0000006, 0.0000011, 0.00000085, 0.00000052, 0.0000003, 0.00000035, 0.0000004, 0.00000032,
    0.00000037, 0.00000042, 0.00000034, 0.00000039, 0.00000044, 0.00000031, 0.00000036, 0.00000041,
];

#[derive(Clone, Debug, PartialEq)]
pub struct EnvironmentInputs {
    pub emission_release_id: StableId,
    pub atmosphere_release_id: StableId,
    pub atmosphere_valid_time_utc: UtcInstant,
    pub directional_intensity_w_sr: Vec<f64>,
    pub mean_surface_pressure_pa: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct ObserverRenderProduct {
    pub observer_render_product_schema_revision: StableId,
    pub physics_abi_revision: StableId,
    pub physics_model_revision: StableId,
    pub physics_data_manifest_id: StableId,
    pub scenario_revision: u64,
    pub coherent_barrier: String,
    pub projection: String,
    pub shape: [usize; 3],
    pub axis_order: [String; 3],
    pub component_type: String,
    pub quantity: String,
    pub unit: String,
    pub values: Vec<f32>,
    pub data_validity: DataValidity,
    pub fidelity: String,
    pub convergence: Convergence,
    pub uncertainty_status: UncertaintyStatus,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DataValidity {
    Valid,
    Missing,
    Masked,
    Censored,
    NotCovered,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum UncertaintyStatus {
    SyntheticNotStatistical,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Convergence {
    pub status: String,
    pub relative_residual: f64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PhysicsError {
    IncompatibleSchema,
    IncompatibleSemantics,
    InvalidUnitsOrCoordinates,
    InvalidDescriptor,
    InsufficientEvidence,
    ResourceExhausted,
    Cancelled,
    NumericalNonConvergence,
}

impl PhysicsError {
    #[must_use]
    pub const fn category(self) -> &'static str {
        match self {
            Self::IncompatibleSchema => "incompatible_schema",
            Self::IncompatibleSemantics => "incompatible_semantics",
            Self::InvalidUnitsOrCoordinates => "invalid_units_or_coordinates",
            Self::InvalidDescriptor => "invalid_descriptor",
            Self::InsufficientEvidence => "insufficient_evidence",
            Self::ResourceExhausted => "resource_exhausted",
            Self::Cancelled => "cancelled",
            Self::NumericalNonConvergence => "numerical_non_convergence",
        }
    }
}

impl fmt::Display for PhysicsError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.category())
    }
}

impl std::error::Error for PhysicsError {}

#[cfg(test)]
mod tests {
    use super::*;

    const SCENARIO: &str = include_str!("../../../../contracts/fixtures/v1/observer-scenario.json");

    #[test]
    fn scenario_rejects_ambient_time_and_malformed_identity() {
        let ambient = SCENARIO.replace("2024-01-15T00:00:00Z", "latest");
        assert_eq!(
            ObserverScenario::from_json(&ambient),
            Err(PhysicsError::InvalidDescriptor)
        );
        let malformed = SCENARIO.replace(
            "emission:fixture:central-poland-2x2:v1",
            "emission with spaces",
        );
        assert_eq!(
            ObserverScenario::from_json(&malformed),
            Err(PhysicsError::InvalidDescriptor)
        );
    }

    #[test]
    fn error_categories_are_stable_abi_vocabulary() {
        assert_eq!(PhysicsError::Cancelled.category(), "cancelled");
        assert_eq!(
            PhysicsError::InvalidUnitsOrCoordinates.category(),
            "invalid_units_or_coordinates"
        );
        assert_eq!(
            PhysicsError::NumericalNonConvergence.category(),
            "numerical_non_convergence"
        );
    }
}

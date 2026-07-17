//! Shared typed quantities for native and Wasm Physics targets.

use serde::{Deserialize, Serialize};

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
    pub observer_scenario_schema_revision: String,
    pub scenario_revision: u64,
    pub observer_wgs84: ObserverLocation,
    pub requested_time_utc: String,
    pub astronomy_time_data_ids: AstronomyTimeDataIds,
    pub emission_release_id: String,
    pub emission_time_context: String,
    pub emission_scenario_policy_id: String,
    pub atmosphere_release_id: String,
    pub atmosphere_selection: ScenarioAtmosphereSelection,
    pub physics_model_revision: String,
    pub physics_data_manifest_id: String,
    pub atmosphere_optics_model_revision: String,
    pub surface_terrain_product_id: String,
    pub output: ObserverOutputRequest,
    pub resource_budget: ResourceBudget,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct AstronomyTimeDataIds {
    pub earth_orientation: String,
    pub leap_seconds: String,
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
    pub valid_time_utc: String,
    pub standard_scenario_id: String,
    pub interpolation_revision: String,
    pub downscaling_revision: String,
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
        if self.astronomy_time_data_ids.earth_orientation.is_empty()
            || self.astronomy_time_data_ids.leap_seconds.is_empty()
            || self.requested_time_utc != self.atmosphere_selection.valid_time_utc
        {
            return Err(PhysicsError::IncompatibleSemantics);
        }
        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct ResolvedAstronomyTime {
    pub requested_time_utc: String,
    pub earth_orientation_id: String,
    pub leap_seconds_id: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct PhysicsDataManifest {
    pub physics_data_manifest_schema_revision: String,
    pub physics_data_manifest_id: String,
    pub physics_model_revision: String,
    pub response_basis_revision: String,
    pub surface_terrain_product_id: String,
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
            || self.surface_terrain_product_id.is_empty()
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
            physics_data_manifest_schema_revision: "physics-data-manifest-fixture-v1".to_owned(),
            physics_data_manifest_id: "physics-data:fixture:v1".to_owned(),
            physics_model_revision: "fixture-single-scatter-scalar-v1".to_owned(),
            response_basis_revision: "fixture-reference-response-v1".to_owned(),
            surface_terrain_product_id: "surface-terrain:fixture-flat-lambertian:v1".to_owned(),
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
    pub surface_terrain_product_schema_revision: String,
    pub surface_terrain_product_id: String,
    pub content_license: String,
    pub height_datum: String,
    pub terrain_height_m: f64,
    pub surface_normal_enu: [f64; 3],
    pub brdf_model: String,
    pub diffuse_albedo: f64,
    pub data_validity: String,
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
            || self.data_validity != "valid"
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
    pub emission_release_id: String,
    pub atmosphere_release_id: String,
    pub atmosphere_valid_time_utc: String,
    pub directional_intensity_w_sr: Vec<f64>,
    pub mean_surface_pressure_pa: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct ObserverRenderProduct {
    pub observer_render_product_schema_revision: String,
    pub physics_abi_revision: String,
    pub physics_model_revision: String,
    pub physics_data_manifest_id: String,
    pub scenario_revision: u64,
    pub coherent_barrier: String,
    pub projection: String,
    pub shape: [usize; 3],
    pub axis_order: [String; 3],
    pub component_type: String,
    pub quantity: String,
    pub unit: String,
    pub values: Vec<f32>,
    pub data_validity: String,
    pub fidelity: String,
    pub convergence: Convergence,
    pub uncertainty_status: String,
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

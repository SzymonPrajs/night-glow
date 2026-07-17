//! Reviewable physical equations shared by native and Wasm targets.

use nightglow_core::{
    ArtificialLightBoundarySource, Convergence, DataValidity, EnvironmentInputs,
    ExtinctionPerMetre, ObserverRenderProduct, ObserverScenario, OpticalAtmosphereState,
    OpticalDepth, PathLengthMetres, PhysicsDataManifest, PhysicsError, ResolvedAstronomyTime,
    StableId, SurfaceTerrainProduct, UncertaintyStatus,
};

/// Exact optical depth through an exponential vertical extinction profile.
#[must_use]
pub fn exponential_optical_depth(
    surface_extinction: ExtinctionPerMetre,
    scale_height: PathLengthMetres,
    path: PathLengthMetres,
) -> OpticalDepth {
    let value = surface_extinction.0 * scale_height.0 * (1.0 - (-path.0 / scale_height.0).exp());
    OpticalDepth(value)
}

/// Composite trapezoid integration of the same profile, used for convergence
/// and native/Wasm parity checks before accepting more complex solvers.
#[must_use]
pub fn exponential_optical_depth_trapezoid(
    surface_extinction: ExtinctionPerMetre,
    scale_height: PathLengthMetres,
    path: PathLengthMetres,
    intervals: u32,
) -> OpticalDepth {
    assert!(intervals > 0);
    let step = path.0 / f64::from(intervals);
    let mut sum =
        0.5 * (surface_extinction.0 + surface_extinction.0 * (-path.0 / scale_height.0).exp());
    for index in 1..intervals {
        let height = f64::from(index) * step;
        sum += surface_extinction.0 * (-height / scale_height.0).exp();
    }
    OpticalDepth(sum * step)
}

/// Beer-Lambert transmittance for a non-negative optical depth.
#[must_use]
pub fn transmittance(optical_depth: OpticalDepth) -> f64 {
    (-optical_depth.0.max(0.0)).exp()
}

/// Analytic single-scattered radiance for a homogeneous collinear slab.
#[must_use]
pub fn homogeneous_single_scatter(
    incident_radiance: f64,
    optical_depth: OpticalDepth,
    single_scattering_albedo: f64,
    phase_per_steradian: f64,
) -> f64 {
    incident_radiance
        * single_scattering_albedo
        * phase_per_steradian
        * optical_depth.0.max(0.0)
        * transmittance(optical_depth)
}

/// Solves the first immutable scenario into one atomic coarse render product.
///
/// The response basis is Physics-owned data for the synthetic reference state.
/// Source intensity and atmospheric-pressure changes are applied through the
/// canonical single-scatter response ratio; no display transform is included.
pub fn solve_first_slice(
    scenario: &ObserverScenario,
    astronomy_time: &ResolvedAstronomyTime,
    environment: &EnvironmentInputs,
    manifest: &PhysicsDataManifest,
    terrain: &SurfaceTerrainProduct,
) -> Result<ObserverRenderProduct, PhysicsError> {
    scenario.validate()?;
    manifest.validate()?;
    terrain.validate()?;
    if astronomy_time.requested_time_utc != scenario.requested_time_utc
        || astronomy_time.earth_orientation_id != scenario.astronomy_time_data_ids.earth_orientation
        || astronomy_time.leap_seconds_id != scenario.astronomy_time_data_ids.leap_seconds
    {
        return Err(PhysicsError::IncompatibleSemantics);
    }
    if scenario.emission_release_id != environment.emission_release_id
        || scenario.atmosphere_release_id != environment.atmosphere_release_id
        || scenario.atmosphere_selection.valid_time_utc != environment.atmosphere_valid_time_utc
        || scenario.physics_model_revision != manifest.physics_model_revision
        || scenario.physics_data_manifest_id != manifest.physics_data_manifest_id
        || scenario.surface_terrain_product_id != manifest.surface_terrain_product_id
        || scenario.surface_terrain_product_id != terrain.surface_terrain_product_id
    {
        return Err(PhysicsError::IncompatibleSemantics);
    }
    if scenario.resource_budget.memory_bytes
        < manifest.response_basis_linear_rgb.len() * size_of::<f32>()
    {
        return Err(PhysicsError::ResourceExhausted);
    }
    let boundary_source = build_artificial_light_boundary_source(environment)?;
    let optical_state = build_optical_atmosphere_state(environment)?;
    let values = solve_fixture_response(
        boundary_source.total_directional_intensity_w_sr,
        optical_state.mean_surface_pressure_pa,
        manifest,
    )?;
    Ok(ObserverRenderProduct {
        observer_render_product_schema_revision: StableId::new("observer-render-fixture-v1")?,
        physics_abi_revision: StableId::new("physics-abi-fixture-v1")?,
        physics_model_revision: manifest.physics_model_revision.clone(),
        physics_data_manifest_id: manifest.physics_data_manifest_id.clone(),
        scenario_revision: scenario.scenario_revision,
        coherent_barrier: "coarse_complete".to_owned(),
        projection: scenario.output.projection.clone(),
        shape: manifest.shape,
        axis_order: [
            "elevation".to_owned(),
            "azimuth".to_owned(),
            "linear_rgb".to_owned(),
        ],
        component_type: "float32".to_owned(),
        quantity: "spectral-response-integrated-radiance".to_owned(),
        unit: "W m-2 sr-1".to_owned(),
        values,
        data_validity: DataValidity::Valid,
        fidelity: "synthetic-contract-only".to_owned(),
        convergence: Convergence {
            status: "converged".to_owned(),
            relative_residual: 0.0,
        },
        uncertainty_status: UncertaintyStatus::SyntheticNotStatistical,
    })
}

pub fn build_artificial_light_boundary_source(
    environment: &EnvironmentInputs,
) -> Result<ArtificialLightBoundarySource, PhysicsError> {
    let total = environment.directional_intensity_w_sr.iter().sum::<f64>();
    if !total.is_finite() || total < 0.0 {
        return Err(PhysicsError::InvalidDescriptor);
    }
    Ok(ArtificialLightBoundarySource {
        total_directional_intensity_w_sr: total,
    })
}

pub fn build_optical_atmosphere_state(
    environment: &EnvironmentInputs,
) -> Result<OpticalAtmosphereState, PhysicsError> {
    if !environment.mean_surface_pressure_pa.is_finite()
        || environment.mean_surface_pressure_pa <= 0.0
    {
        return Err(PhysicsError::InvalidDescriptor);
    }
    Ok(OpticalAtmosphereState {
        mean_surface_pressure_pa: environment.mean_surface_pressure_pa,
    })
}

pub fn solve_fixture_response(
    total_directional_intensity_w_sr: f64,
    mean_surface_pressure_pa: f64,
    manifest: &PhysicsDataManifest,
) -> Result<Vec<f32>, PhysicsError> {
    manifest.validate()?;
    if !total_directional_intensity_w_sr.is_finite()
        || total_directional_intensity_w_sr < 0.0
        || !mean_surface_pressure_pa.is_finite()
        || mean_surface_pressure_pa <= 0.0
    {
        return Err(PhysicsError::InvalidDescriptor);
    }
    let reference_extinction =
        ExtinctionPerMetre(manifest.surface_extinction_per_m_at_reference_pressure);
    let actual_extinction = ExtinctionPerMetre(
        reference_extinction.0 * mean_surface_pressure_pa / manifest.reference_surface_pressure_pa,
    );
    let scale_height = PathLengthMetres(manifest.scale_height_m);
    let path = PathLengthMetres(manifest.path_length_m);
    let reference_tau = exponential_optical_depth(reference_extinction, scale_height, path);
    let actual_tau = exponential_optical_depth(actual_extinction, scale_height, path);
    let reference_response = reference_tau.0 * transmittance(reference_tau);
    let actual_response = actual_tau.0 * transmittance(actual_tau);
    if reference_response <= 0.0 || !actual_response.is_finite() {
        return Err(PhysicsError::NumericalNonConvergence);
    }
    let scale = total_directional_intensity_w_sr / manifest.reference_directional_intensity_w_sr
        * actual_response
        / reference_response;
    Ok(manifest
        .response_basis_linear_rgb
        .iter()
        .map(|value| (value * scale) as f32)
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trapezoid_converges_to_exponential_integral() {
        let beta = ExtinctionPerMetre(1.2e-4);
        let scale = PathLengthMetres(8_000.0);
        let path = PathLengthMetres(60_000.0);
        let exact = exponential_optical_depth(beta, scale, path).0;
        let coarse = exponential_optical_depth_trapezoid(beta, scale, path, 16).0;
        let fine = exponential_optical_depth_trapezoid(beta, scale, path, 4_096).0;
        assert!((fine - exact).abs() / exact < 1.0e-6);
        assert!((fine - exact).abs() < (coarse - exact).abs());
    }

    #[test]
    fn limiting_cases_are_positive_and_conservative() {
        assert_eq!(transmittance(OpticalDepth(0.0)), 1.0);
        let radiance = homogeneous_single_scatter(2.0, OpticalDepth(0.5), 0.9, 0.1);
        assert!(radiance.is_finite() && radiance > 0.0 && radiance < 2.0);
        assert_eq!(
            homogeneous_single_scatter(2.0, OpticalDepth(0.0), 0.9, 0.1),
            0.0
        );
    }

    #[test]
    fn fixture_response_reproduces_reference_basis() {
        let manifest = PhysicsDataManifest::first_slice_fixture();
        let values = solve_fixture_response(70.0, 99_850.0, &manifest).unwrap();
        for (actual, expected) in values.iter().zip(&manifest.response_basis_linear_rgb) {
            assert!((f64::from(*actual) - expected).abs() / expected.abs() < 1.0e-6);
        }
    }
}

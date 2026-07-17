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

/// Spherical-shell geometry and an exponential extinction profile measured
/// from the declared planet surface.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SphericalExponentialAtmosphere {
    pub planet_radius: PathLengthMetres,
    pub observer_altitude: PathLengthMetres,
    pub top_altitude: PathLengthMetres,
    pub surface_extinction: ExtinctionPerMetre,
    pub scale_height: PathLengthMetres,
}

/// Distance from the observer to the top-of-atmosphere sphere along an upward
/// ray. `zenith_cosine` is one at zenith and zero at the geometric horizon.
pub fn spherical_ray_length_to_top(
    atmosphere: SphericalExponentialAtmosphere,
    zenith_cosine: f64,
) -> Result<PathLengthMetres, PhysicsError> {
    validate_spherical_atmosphere(atmosphere, zenith_cosine)?;
    let observer_radius = atmosphere.planet_radius.0 + atmosphere.observer_altitude.0;
    let top_radius = atmosphere.planet_radius.0 + atmosphere.top_altitude.0;
    let discriminant = top_radius * top_radius
        - observer_radius * observer_radius * (1.0 - zenith_cosine * zenith_cosine);
    if !discriminant.is_finite() || discriminant < 0.0 {
        return Err(PhysicsError::InvalidUnitsOrCoordinates);
    }
    let length = (top_radius * top_radius - observer_radius * observer_radius)
        / (discriminant.sqrt() + observer_radius * zenith_cosine);
    if !length.is_finite() || length <= 0.0 {
        return Err(PhysicsError::InvalidUnitsOrCoordinates);
    }
    Ok(PathLengthMetres(length))
}

/// Composite-Simpson optical depth through a spherical exponential atmosphere.
/// The interval count must be positive and even so convergence is explicit.
pub fn spherical_exponential_optical_depth(
    atmosphere: SphericalExponentialAtmosphere,
    zenith_cosine: f64,
    intervals: u32,
) -> Result<OpticalDepth, PhysicsError> {
    if intervals == 0 || !intervals.is_multiple_of(2) {
        return Err(PhysicsError::InvalidDescriptor);
    }
    let path = spherical_ray_length_to_top(atmosphere, zenith_cosine)?.0;
    let step = path / f64::from(intervals);
    let mut weighted_sum = spherical_extinction_at_distance(atmosphere, zenith_cosine, 0.0)?
        + spherical_extinction_at_distance(atmosphere, zenith_cosine, path)?;
    for index in 1..intervals {
        let weight = if index.is_multiple_of(2) { 2.0 } else { 4.0 };
        weighted_sum += weight
            * spherical_extinction_at_distance(atmosphere, zenith_cosine, f64::from(index) * step)?;
    }
    let optical_depth = weighted_sum * step / 3.0;
    if !optical_depth.is_finite() || optical_depth < 0.0 {
        return Err(PhysicsError::NumericalNonConvergence);
    }
    Ok(OpticalDepth(optical_depth))
}

fn validate_spherical_atmosphere(
    atmosphere: SphericalExponentialAtmosphere,
    zenith_cosine: f64,
) -> Result<(), PhysicsError> {
    if !atmosphere.planet_radius.0.is_finite()
        || atmosphere.planet_radius.0 <= 0.0
        || !atmosphere.observer_altitude.0.is_finite()
        || atmosphere.observer_altitude.0 < 0.0
        || !atmosphere.top_altitude.0.is_finite()
        || atmosphere.top_altitude.0 <= atmosphere.observer_altitude.0
        || !atmosphere.surface_extinction.0.is_finite()
        || atmosphere.surface_extinction.0 < 0.0
        || !atmosphere.scale_height.0.is_finite()
        || atmosphere.scale_height.0 <= 0.0
        || !zenith_cosine.is_finite()
        || !(0.0..=1.0).contains(&zenith_cosine)
    {
        return Err(PhysicsError::InvalidUnitsOrCoordinates);
    }
    Ok(())
}

fn spherical_extinction_at_distance(
    atmosphere: SphericalExponentialAtmosphere,
    zenith_cosine: f64,
    distance: f64,
) -> Result<f64, PhysicsError> {
    let observer_radius = atmosphere.planet_radius.0 + atmosphere.observer_altitude.0;
    let radius_squared = observer_radius * observer_radius
        + distance * distance
        + 2.0 * observer_radius * distance * zenith_cosine;
    if !radius_squared.is_finite() || radius_squared < 0.0 {
        return Err(PhysicsError::NumericalNonConvergence);
    }
    let altitude = radius_squared.sqrt() - atmosphere.planet_radius.0;
    let extinction =
        atmosphere.surface_extinction.0 * (-altitude / atmosphere.scale_height.0).exp();
    if !extinction.is_finite() || extinction < 0.0 {
        return Err(PhysicsError::NumericalNonConvergence);
    }
    Ok(extinction)
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

    fn spherical_fixture() -> SphericalExponentialAtmosphere {
        SphericalExponentialAtmosphere {
            planet_radius: PathLengthMetres(6_371_000.0),
            observer_altitude: PathLengthMetres(0.0),
            top_altitude: PathLengthMetres(120_000.0),
            surface_extinction: ExtinctionPerMetre(1.2e-4),
            scale_height: PathLengthMetres(8_000.0),
        }
    }

    #[test]
    fn spherical_ray_geometry_has_exact_vertical_and_horizon_limits() {
        let atmosphere = spherical_fixture();
        let vertical = spherical_ray_length_to_top(atmosphere, 1.0).unwrap().0;
        assert!((vertical - 120_000.0).abs() < 1.0e-9);

        let horizon = spherical_ray_length_to_top(atmosphere, 0.0).unwrap().0;
        let expected = ((6_371_000.0_f64 + 120_000.0).powi(2) - 6_371_000.0_f64.powi(2)).sqrt();
        assert!((horizon - expected).abs() / expected < 1.0e-14);
        assert!(horizon > vertical);
    }

    #[test]
    fn spherical_vertical_integral_matches_the_exponential_closed_form() {
        let atmosphere = spherical_fixture();
        let actual = spherical_exponential_optical_depth(atmosphere, 1.0, 4_096)
            .unwrap()
            .0;
        let expected = atmosphere.surface_extinction.0
            * atmosphere.scale_height.0
            * (1.0 - (-atmosphere.top_altitude.0 / atmosphere.scale_height.0).exp());
        assert!((actual - expected).abs() / expected < 1.0e-11);
    }

    #[test]
    fn horizon_integral_converges_and_rejects_ambiguous_geometry() {
        let atmosphere = spherical_fixture();
        let reference = spherical_exponential_optical_depth(atmosphere, 0.0, 32_768)
            .unwrap()
            .0;
        let coarse = spherical_exponential_optical_depth(atmosphere, 0.0, 128)
            .unwrap()
            .0;
        let fine = spherical_exponential_optical_depth(atmosphere, 0.0, 512)
            .unwrap()
            .0;
        assert!((fine - reference).abs() < (coarse - reference).abs());
        assert!((fine - reference).abs() / reference < 1.0e-8);
        assert_eq!(
            spherical_exponential_optical_depth(atmosphere, 0.0, 511),
            Err(PhysicsError::InvalidDescriptor)
        );
        assert_eq!(
            spherical_ray_length_to_top(atmosphere, -0.1),
            Err(PhysicsError::InvalidUnitsOrCoordinates)
        );
    }
}

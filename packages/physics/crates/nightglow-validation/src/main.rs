use nightglow_core::{ExtinctionPerMetre, ObserverScenario, OpticalDepth, PathLengthMetres};
use nightglow_data::{decode_environment_products, decode_physics_assets};
use nightglow_physics::{
    exponential_optical_depth, exponential_optical_depth_trapezoid, homogeneous_single_scatter,
};
use nightglow_solver::{CancellationToken, solve_scenario};
use serde::Deserialize;
use std::time::Instant;

fn main() {
    let beta = ExtinctionPerMetre(1.2e-4);
    let scale = PathLengthMetres(8_000.0);
    let path = PathLengthMetres(60_000.0);
    let exact = exponential_optical_depth(beta, scale, path).0;

    let started = Instant::now();
    let coarse = exponential_optical_depth_trapezoid(beta, scale, path, 16).0;
    let fine = exponential_optical_depth_trapezoid(beta, scale, path, 4_096).0;
    let elapsed = started.elapsed();
    let coarse_error = relative_error(coarse, exact);
    let fine_error = relative_error(fine, exact);
    let single_scatter = homogeneous_single_scatter(2.0, OpticalDepth(exact), 0.9, 0.1);

    let environment = decode_environment_products(
        include_str!("../../../../contracts/fixtures/v1/emission-release.json"),
        include_str!("../../../../contracts/fixtures/v1/atmosphere-release.json"),
    )
    .expect("Environment fixtures should conform");
    let scenario = ObserverScenario::from_json(include_str!(
        "../../../../contracts/fixtures/v1/observer-scenario.json"
    ))
    .expect("scenario should conform");
    let assets = decode_physics_assets(
        include_str!("../../../fixtures/v1/physics-data-manifest.json"),
        include_str!("../../../fixtures/v1/surface-terrain-product.json"),
    )
    .expect("Physics assets should conform");
    let render = solve_scenario(
        &scenario,
        &environment,
        &assets,
        &CancellationToken::default(),
        |_| {},
    )
    .expect("first slice should solve");
    let expected: ExpectedRender = serde_json::from_str(include_str!(
        "../../../../contracts/fixtures/v1/observer-render-product.json"
    ))
    .expect("expected render fixture");
    let render_error = render
        .values
        .iter()
        .zip(&expected.values)
        .map(|(actual, expected)| relative_error(f64::from(*actual), *expected))
        .fold(0.0, f64::max);

    assert!(fine_error < 1.0e-6);
    assert!(fine_error < coarse_error);
    assert!(single_scatter.is_finite() && single_scatter > 0.0 && single_scatter < 2.0);
    assert_eq!(render.scenario_revision, expected.scenario_revision);
    assert_eq!(render.values.len(), expected.values.len());
    assert!(render_error < 1.0e-6);

    println!(
        concat!(
            "{{\n",
            "  \"analytic_optical_depth\": {:.12},\n",
            "  \"coarse_relative_error\": {:.12e},\n",
            "  \"fine_relative_error\": {:.12e},\n",
            "  \"single_scatter_radiance\": {:.12},\n",
            "  \"probe_elapsed_microseconds\": {},\n",
            "  \"environment_directional_intensity_w_sr\": {:.1},\n",
            "  \"environment_mean_surface_pressure_pa\": {:.1},\n",
            "  \"render_values\": {},\n",
            "  \"render_f32_relative_error\": {:.12e}\n",
            "}}"
        ),
        exact,
        coarse_error,
        fine_error,
        single_scatter,
        elapsed.as_micros(),
        environment.directional_intensity_w_sr.iter().sum::<f64>(),
        environment.mean_surface_pressure_pa,
        render.values.len(),
        render_error,
    );
}

#[derive(Deserialize)]
struct ExpectedRender {
    scenario_revision: u64,
    values: Vec<f64>,
}

fn relative_error(actual: f64, expected: f64) -> f64 {
    (actual - expected).abs() / expected.abs().max(f64::EPSILON)
}

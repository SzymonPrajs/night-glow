//! Thin C-compatible exports for the first native/Wasm parity proof.

use nightglow_core::{EnvironmentInputs, ExtinctionPerMetre, ObserverScenario, PathLengthMetres};
use nightglow_data::decode_physics_assets;
use nightglow_physics::{exponential_optical_depth_trapezoid, transmittance};
use nightglow_solver::{CancellationToken, solve_scenario};
use std::cell::RefCell;

thread_local! {
    static OUTPUT: RefCell<Vec<f32>> = const { RefCell::new(Vec::new()) };
}

#[unsafe(no_mangle)]
pub extern "C" fn nightglow_physics_abi_revision() -> u32 {
    1
}

/// Computes transmittance through an exponential profile using shared Physics.
#[unsafe(no_mangle)]
pub extern "C" fn nightglow_exponential_transmittance(
    surface_extinction_per_m: f64,
    scale_height_m: f64,
    path_length_m: f64,
    intervals: u32,
) -> f64 {
    let optical_depth = exponential_optical_depth_trapezoid(
        ExtinctionPerMetre(surface_extinction_per_m),
        PathLengthMetres(scale_height_m),
        PathLengthMetres(path_length_m),
        intervals,
    );
    transmittance(optical_depth)
}

/// Solves the complete first-slice response into a Wasm-owned view.
///
/// The pointer remains valid until the next solve on this module instance.
#[unsafe(no_mangle)]
pub extern "C" fn nightglow_first_slice_solve(
    total_directional_intensity_w_sr: f64,
    mean_surface_pressure_pa: f64,
) -> usize {
    let scenario = ObserverScenario::from_json(include_str!(
        "../../../../contracts/fixtures/v1/observer-scenario.json"
    ));
    let assets = decode_physics_assets(
        include_str!("../../../fixtures/v1/physics-data-manifest.json"),
        include_str!("../../../fixtures/v1/surface-terrain-product.json"),
    );
    let environment = EnvironmentInputs {
        emission_release_id: "emission:fixture:central-poland-2x2:v1".to_owned(),
        atmosphere_release_id: "atmosphere:fixture:central-poland-2x2x3:v1".to_owned(),
        atmosphere_valid_time_utc: "2024-01-15T00:00:00Z".to_owned(),
        directional_intensity_w_sr: vec![total_directional_intensity_w_sr],
        mean_surface_pressure_pa,
    };
    let values = scenario.and_then(|scenario| {
        assets.and_then(|assets| {
            solve_scenario(
                &scenario,
                &environment,
                &assets,
                &CancellationToken::default(),
                |_| {},
            )
            .map(|product| product.values)
        })
    });
    let Ok(values) = values else {
        OUTPUT.with(|output| output.borrow_mut().clear());
        return 0;
    };
    OUTPUT.with(|output| {
        let mut output = output.borrow_mut();
        *output = values;
        output.as_ptr() as usize
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn nightglow_first_slice_output_len() -> u32 {
    OUTPUT.with(|output| u32::try_from(output.borrow().len()).unwrap_or(0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_slice_output_has_coherent_fixture_shape() {
        let pointer = nightglow_first_slice_solve(70.0, 99_850.0);
        assert_ne!(pointer, 0);
        assert_eq!(nightglow_first_slice_output_len(), 24);
    }
}

//! Deterministic first-slice computation order, progress, and cancellation.

use nightglow_astronomy::resolve_time_state;
use nightglow_core::{EnvironmentInputs, ObserverRenderProduct, ObserverScenario, PhysicsError};
use nightglow_data::PhysicsAssets;
use nightglow_physics::solve_first_slice;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SolverStage {
    ResolveAstronomy,
    ValidateAssets,
    SolveTransfer,
    PublishProduct,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SolverProgress {
    pub stage: SolverStage,
    pub completed_fraction: f32,
    pub relative_residual: Option<f64>,
}

#[derive(Debug, Default)]
pub struct CancellationToken {
    cancelled: AtomicBool,
}

impl CancellationToken {
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::Release);
    }

    #[must_use]
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Acquire)
    }

    fn checkpoint(&self) -> Result<(), PhysicsError> {
        if self.is_cancelled() {
            Err(PhysicsError::Cancelled)
        } else {
            Ok(())
        }
    }
}

pub fn solve_scenario(
    scenario: &ObserverScenario,
    environment: &EnvironmentInputs,
    assets: &PhysicsAssets,
    cancellation: &CancellationToken,
    mut progress: impl FnMut(SolverProgress),
) -> Result<ObserverRenderProduct, PhysicsError> {
    cancellation.checkpoint()?;
    progress(SolverProgress {
        stage: SolverStage::ResolveAstronomy,
        completed_fraction: 0.1,
        relative_residual: None,
    });
    let astronomy_time = resolve_time_state(scenario)?;

    cancellation.checkpoint()?;
    assets.manifest.validate()?;
    assets.terrain.validate()?;
    progress(SolverProgress {
        stage: SolverStage::ValidateAssets,
        completed_fraction: 0.3,
        relative_residual: None,
    });

    cancellation.checkpoint()?;
    progress(SolverProgress {
        stage: SolverStage::SolveTransfer,
        completed_fraction: 0.7,
        relative_residual: None,
    });
    let product = solve_first_slice(
        scenario,
        &astronomy_time,
        environment,
        &assets.manifest,
        &assets.terrain,
    )?;

    cancellation.checkpoint()?;
    progress(SolverProgress {
        stage: SolverStage::PublishProduct,
        completed_fraction: 1.0,
        relative_residual: Some(product.convergence.relative_residual),
    });
    Ok(product)
}

#[cfg(test)]
mod tests {
    use super::*;
    use nightglow_core::ObserverScenario;
    use nightglow_data::{decode_environment_products, decode_physics_assets};

    const SCENARIO: &str = include_str!("../../../../contracts/fixtures/v1/observer-scenario.json");
    const EMISSION: &str = include_str!("../../../../contracts/fixtures/v1/emission-release.json");
    const ATMOSPHERE: &str =
        include_str!("../../../../contracts/fixtures/v1/atmosphere-release.json");
    const MANIFEST: &str = include_str!("../../../fixtures/v1/physics-data-manifest.json");
    const TERRAIN: &str = include_str!("../../../fixtures/v1/surface-terrain-product.json");

    #[test]
    fn runs_the_declared_dag_and_publishes_atomically() {
        let scenario = ObserverScenario::from_json(SCENARIO).unwrap();
        let environment = decode_environment_products(EMISSION, ATMOSPHERE).unwrap();
        let assets = decode_physics_assets(MANIFEST, TERRAIN).unwrap();
        let mut stages = Vec::new();
        let product = solve_scenario(
            &scenario,
            &environment,
            &assets,
            &CancellationToken::default(),
            |event| stages.push(event.stage),
        )
        .unwrap();
        assert_eq!(
            stages,
            [
                SolverStage::ResolveAstronomy,
                SolverStage::ValidateAssets,
                SolverStage::SolveTransfer,
                SolverStage::PublishProduct,
            ]
        );
        assert_eq!(product.values.len(), 24);
    }

    #[test]
    fn cancellation_never_publishes_a_partial_product() {
        let scenario = ObserverScenario::from_json(SCENARIO).unwrap();
        let environment = decode_environment_products(EMISSION, ATMOSPHERE).unwrap();
        let assets = decode_physics_assets(MANIFEST, TERRAIN).unwrap();
        let cancellation = CancellationToken::default();
        cancellation.cancel();
        let mut progress_count = 0;
        let result = solve_scenario(&scenario, &environment, &assets, &cancellation, |_| {
            progress_count += 1
        });
        assert_eq!(result, Err(PhysicsError::Cancelled));
        assert_eq!(progress_count, 0);
    }
}

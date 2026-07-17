//! Physics-owned asset decoding and conforming Environment adapters.
//!
//! This crate accepts bytes supplied by native or Wasm hosts. It has no file,
//! network, provider-ingest, or cache policy.

use nightglow_core::{EnvironmentInputs, PhysicsDataManifest, PhysicsError, SurfaceTerrainProduct};
use nightglow_environment::decode_environment_inputs;

#[derive(Clone, Debug, PartialEq)]
pub struct PhysicsAssets {
    pub manifest: PhysicsDataManifest,
    pub terrain: SurfaceTerrainProduct,
}

pub fn decode_physics_assets(
    manifest_json: &str,
    terrain_json: &str,
) -> Result<PhysicsAssets, PhysicsError> {
    let manifest = PhysicsDataManifest::from_json(manifest_json)?;
    let terrain = SurfaceTerrainProduct::from_json(terrain_json)?;
    if manifest.surface_terrain_product_id != terrain.surface_terrain_product_id {
        return Err(PhysicsError::IncompatibleSemantics);
    }
    Ok(PhysicsAssets { manifest, terrain })
}

pub fn decode_environment_products(
    emission_json: &str,
    atmosphere_json: &str,
) -> Result<EnvironmentInputs, PhysicsError> {
    decode_environment_inputs(emission_json, atmosphere_json)
}

#[cfg(test)]
mod tests {
    use super::*;

    const MANIFEST: &str = include_str!("../../../fixtures/v1/physics-data-manifest.json");
    const TERRAIN: &str = include_str!("../../../fixtures/v1/surface-terrain-product.json");
    const EMISSION: &str = include_str!("../../../../contracts/fixtures/v1/emission-release.json");
    const ATMOSPHERE: &str =
        include_str!("../../../../contracts/fixtures/v1/atmosphere-release.json");

    #[test]
    fn decodes_pinned_assets_and_independent_environment_products() {
        let assets = decode_physics_assets(MANIFEST, TERRAIN).unwrap();
        let environment = decode_environment_products(EMISSION, ATMOSPHERE).unwrap();
        assert_eq!(
            assets.manifest.surface_terrain_product_id,
            assets.terrain.surface_terrain_product_id
        );
        assert_eq!(
            environment.directional_intensity_w_sr.iter().sum::<f64>(),
            70.0
        );
    }

    #[test]
    fn rejects_mismatched_asset_identity() {
        let corrupt = TERRAIN.replace(
            "surface-terrain:fixture-flat-lambertian:v1",
            "surface-terrain:fixture-other:v1",
        );
        assert_eq!(
            decode_physics_assets(MANIFEST, &corrupt),
            Err(PhysicsError::IncompatibleSemantics)
        );
    }
}

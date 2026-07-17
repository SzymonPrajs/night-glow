use atmosphere_format::query_atmosphere;
use atmosphere_schema::AtmosphereFieldRelease;
use emission_core::query_emission;
use emission_schema::EmissionRelease;
use environment_core::{StableId, Wgs84Bounds};
use environment_manifest::EnvironmentReleaseSet;

const EMISSION: &str = include_str!("../../../../contracts/fixtures/v1/emission-release.json");
const ATMOSPHERE: &str = include_str!("../../../../contracts/fixtures/v1/atmosphere-release.json");

fn main() {
    let emission = EmissionRelease::from_json(EMISSION).expect("emission fixture");
    let atmosphere = AtmosphereFieldRelease::from_json(ATMOSPHERE).expect("atmosphere fixture");
    let release_set = EnvironmentReleaseSet {
        manifest_schema_revision: StableId::new("environment-manifest-fixture-v1").unwrap(),
        release_set_id: StableId::new("environment-set:fixture:central-poland:v1").unwrap(),
        emission_release_id: emission.emission_release_id.clone(),
        atmosphere_release_id: atmosphere.atmosphere_release_id.clone(),
    };
    release_set
        .validate(&emission, &atmosphere)
        .expect("compatible releases");
    let bounds = Wgs84Bounds::new(20.99, 51.99, 21.03, 52.03).unwrap();
    let emission_batch = query_emission(&emission, bounds).unwrap();
    let atmosphere_volume = query_atmosphere(
        &atmosphere,
        bounds,
        &["pressure_pa", "temperature_k", "relative_humidity_fraction"],
    )
    .unwrap();
    println!(
        concat!(
            "{{\n",
            "  \"release_set_id\": \"{}\",\n",
            "  \"emission_cells\": {},\n",
            "  \"directional_intensity_w_sr\": {:.1},\n",
            "  \"atmosphere_shape\": [{}, {}, {}],\n",
            "  \"mean_surface_pressure_pa\": {:.1}\n",
            "}}"
        ),
        release_set.release_set_id,
        emission_batch.len(),
        emission_batch.total_directional_intensity_w_sr(),
        atmosphere_volume.shape[0],
        atmosphere_volume.shape[1],
        atmosphere_volume.shape[2],
        atmosphere_volume.mean_surface_pressure_pa().unwrap(),
    );
}

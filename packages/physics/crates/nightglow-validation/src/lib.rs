//! Typed import and comparison of independently generated validation vectors.

use nightglow_core::OpticalDepth;
use nightglow_physics::transmittance;
use serde::Deserialize;

const EXPECTED_FIXTURE_REVISION: &str = "libradtran-pure-absorption-v1";
const EXPECTED_QUANTITY: &str = "projected-direct-beam-transmittance";

#[derive(Debug, Deserialize)]
pub struct ReferenceTransferFixture {
    pub fixture_revision: String,
    pub generated_output_license: String,
    pub solver: ReferenceSolver,
    pub artifacts: ReferenceArtifacts,
    pub quantity: String,
    pub unit: String,
    pub wavelength_nm: f64,
    pub vertical_absorption_optical_depth: f64,
    pub relative_tolerance: f64,
    pub cases: Vec<ReferenceCase>,
}

#[derive(Debug, Deserialize)]
pub struct ReferenceSolver {
    pub name: String,
    pub version: String,
    pub rte_solver: String,
    pub source_archive_url: String,
    pub source_archive_sha256: String,
    pub source_license: String,
}

#[derive(Debug, Deserialize)]
pub struct ReferenceArtifacts {
    pub reference_absorption_sha256: String,
    pub reference_scattering_sha256: String,
    pub reference_sza_0_sha256: String,
    pub reference_sza_30_sha256: String,
    pub reference_sza_45_sha256: String,
    pub reference_output_sha256: String,
}

#[derive(Debug, Deserialize)]
pub struct ReferenceCase {
    pub case_id: String,
    pub solar_zenith_deg: f64,
    pub reference_value: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ReferenceComparison {
    pub case_count: usize,
    pub max_relative_error: f64,
    pub relative_tolerance: f64,
    pub within_tolerance: bool,
}

pub fn compare_libradtran_pure_absorption(json: &str) -> Result<ReferenceComparison, &'static str> {
    let fixture: ReferenceTransferFixture =
        serde_json::from_str(json).map_err(|_| "invalid reference JSON")?;
    validate_fixture(&fixture)?;

    let mut max_relative_error = 0.0_f64;
    for case in &fixture.cases {
        let cosine = case.solar_zenith_deg.to_radians().cos();
        let slant_optical_depth = fixture.vertical_absorption_optical_depth / cosine;
        let candidate = cosine * transmittance(OpticalDepth(slant_optical_depth));
        max_relative_error =
            max_relative_error.max(relative_error(candidate, case.reference_value));
    }

    Ok(ReferenceComparison {
        case_count: fixture.cases.len(),
        max_relative_error,
        relative_tolerance: fixture.relative_tolerance,
        within_tolerance: max_relative_error <= fixture.relative_tolerance,
    })
}

fn validate_fixture(fixture: &ReferenceTransferFixture) -> Result<(), &'static str> {
    if fixture.fixture_revision != EXPECTED_FIXTURE_REVISION
        || fixture.generated_output_license != "CC0-1.0"
        || fixture.quantity != EXPECTED_QUANTITY
        || fixture.unit != "1"
        || fixture.solver.name != "libRadtran"
        || fixture.solver.version != "2.0.6-MYSTIC"
        || fixture.solver.rte_solver != "disort"
        || fixture.solver.source_license != "GPL-2.0-or-later"
        || !fixture
            .solver
            .source_archive_url
            .starts_with("https://www.libradtran.org/")
        || fixture.solver.source_archive_sha256.len() != 64
        || artifact_hashes(&fixture.artifacts)
            .iter()
            .any(|hash| hash.len() != 64 || !hash.bytes().all(|byte| byte.is_ascii_hexdigit()))
        || !fixture.wavelength_nm.is_finite()
        || fixture.wavelength_nm <= 0.0
        || !fixture.vertical_absorption_optical_depth.is_finite()
        || fixture.vertical_absorption_optical_depth < 0.0
        || !fixture.relative_tolerance.is_finite()
        || fixture.relative_tolerance <= 0.0
        || fixture.cases.is_empty()
    {
        return Err("incompatible reference semantics");
    }
    if fixture.cases.iter().any(|case| {
        case.case_id.is_empty()
            || !case.solar_zenith_deg.is_finite()
            || !(0.0..90.0).contains(&case.solar_zenith_deg)
            || !case.reference_value.is_finite()
            || !(0.0..=1.0).contains(&case.reference_value)
    }) {
        return Err("invalid reference case");
    }
    Ok(())
}

fn artifact_hashes(artifacts: &ReferenceArtifacts) -> [&str; 6] {
    [
        &artifacts.reference_absorption_sha256,
        &artifacts.reference_scattering_sha256,
        &artifacts.reference_sza_0_sha256,
        &artifacts.reference_sza_30_sha256,
        &artifacts.reference_sza_45_sha256,
        &artifacts.reference_output_sha256,
    ]
}

fn relative_error(actual: f64, expected: f64) -> f64 {
    (actual - expected).abs() / expected.abs().max(f64::EPSILON)
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../../../fixtures/v1/libradtran-pure-absorption.json");

    #[test]
    fn beer_lambert_matches_three_independent_disort_runs() {
        let comparison = compare_libradtran_pure_absorption(FIXTURE).unwrap();
        assert_eq!(comparison.case_count, 3);
        assert!(comparison.within_tolerance);
        assert!(comparison.max_relative_error < 7.0e-8);
    }

    #[test]
    fn reports_reference_drift_without_weakening_the_tolerance() {
        let drifted = FIXTURE.replace("0.6065307", "0.7000000");
        let comparison = compare_libradtran_pure_absorption(&drifted).unwrap();
        assert!(!comparison.within_tolerance);
        assert_eq!(comparison.relative_tolerance, 1.0e-6);
    }

    #[test]
    fn rejects_changed_quantity_or_solver_identity() {
        let changed_quantity = FIXTURE.replace(
            "projected-direct-beam-transmittance",
            "unprojected-transmittance",
        );
        assert!(compare_libradtran_pure_absorption(&changed_quantity).is_err());

        let changed_solver = FIXTURE.replace("2.0.6-MYSTIC", "unknown");
        assert!(compare_libradtran_pure_absorption(&changed_solver).is_err());
    }
}

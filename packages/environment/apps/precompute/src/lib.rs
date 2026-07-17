//! Thin deterministic orchestration over Environment-owned fixture adapters.

use atmosphere_ingest::{CanonicalUnit, ExtractedProviderVariable, Provider};
use emission_ingest_black_marble::{ExtractedGranule, RetrievalQuality};
use environment_core::EnvironmentError;
use serde::Serialize;

const BLACK_MARBLE_FIXTURE: &str =
    include_str!("../../../fixtures/v1/black-marble-vnp46a2-extract.json");
const ATMOSPHERE_FIXTURE: &str =
    include_str!("../../../fixtures/v1/atmosphere-provider-extracts.json");

#[derive(Debug, PartialEq, Serialize)]
pub struct FixtureReport {
    pub report_revision: &'static str,
    pub emission: EmissionFixtureReport,
    pub atmosphere: AtmosphereFixtureReport,
    pub limitation: &'static str,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct EmissionFixtureReport {
    pub source_granule_id: String,
    pub normalized_pixels: usize,
    pub direct_radiance_samples: usize,
    pub gap_filled_radiance_samples: usize,
    pub high_quality_samples: usize,
    pub no_retrieval_samples: usize,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct AtmosphereFixtureReport {
    pub variables: usize,
    pub provider_families: Vec<&'static str>,
    pub canonical_units: Vec<&'static str>,
    pub normalized_samples: usize,
    pub missing_samples: usize,
}

pub fn build_fixture_report() -> Result<FixtureReport, EnvironmentError> {
    let granule = ExtractedGranule::from_json(BLACK_MARBLE_FIXTURE)?;
    let pixels = granule.normalize()?;
    let variables = ExtractedProviderVariable::collection_from_json(ATMOSPHERE_FIXTURE)?;
    let normalized = variables
        .iter()
        .map(ExtractedProviderVariable::normalize)
        .collect::<Result<Vec<_>, _>>()?;

    Ok(FixtureReport {
        report_revision: "environment-extracted-fixture-report-v1",
        emission: EmissionFixtureReport {
            source_granule_id: granule.source_granule_id.as_str().to_owned(),
            normalized_pixels: pixels.len(),
            direct_radiance_samples: pixels
                .iter()
                .filter(|pixel| pixel.direct_radiance_nw_cm2_sr.is_some())
                .count(),
            gap_filled_radiance_samples: pixels
                .iter()
                .filter(|pixel| pixel.gap_filled_radiance_nw_cm2_sr.is_some())
                .count(),
            high_quality_samples: pixels
                .iter()
                .filter(|pixel| pixel.retrieval_quality == RetrievalQuality::HighQuality)
                .count(),
            no_retrieval_samples: pixels
                .iter()
                .filter(|pixel| pixel.retrieval_quality == RetrievalQuality::NoRetrieval)
                .count(),
        },
        atmosphere: AtmosphereFixtureReport {
            variables: normalized.len(),
            provider_families: normalized
                .iter()
                .map(|variable| provider_name(variable.provider))
                .collect(),
            canonical_units: normalized
                .iter()
                .map(|variable| canonical_unit_name(variable.unit))
                .collect(),
            normalized_samples: normalized
                .iter()
                .map(|variable| variable.values.iter().flatten().count())
                .sum(),
            missing_samples: normalized
                .iter()
                .map(|variable| {
                    variable
                        .values
                        .iter()
                        .filter(|value| value.is_none())
                        .count()
                })
                .sum(),
        },
        limitation: "synthetic extracted metadata only; no provider files were fetched or decoded",
    })
}

const fn provider_name(provider: Provider) -> &'static str {
    match provider {
        Provider::Era5 => "ERA5",
        Provider::Cams => "CAMS",
        Provider::Merra2 => "MERRA-2",
    }
}

const fn canonical_unit_name(unit: CanonicalUnit) -> &'static str {
    match unit {
        CanonicalUnit::Pascal => "Pa",
        CanonicalUnit::Kelvin => "K",
        CanonicalUnit::Fraction => "1",
        CanonicalUnit::MetreGeopotentialHeight => "m",
        CanonicalUnit::KilogramPerKilogram => "kg kg-1",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fixture_report_is_deterministic_and_keeps_domain_boundaries_visible() {
        let report = build_fixture_report().unwrap();
        assert_eq!(report.emission.normalized_pixels, 7);
        assert_eq!(report.emission.high_quality_samples, 1);
        assert_eq!(report.emission.no_retrieval_samples, 1);
        assert_eq!(report.atmosphere.variables, 3);
        assert_eq!(
            report.atmosphere.provider_families,
            ["ERA5", "CAMS", "MERRA-2"]
        );
        assert_eq!(report.atmosphere.canonical_units, ["Pa", "1", "kg kg-1"]);
        assert_eq!(report.atmosphere.normalized_samples, 6);
        assert_eq!(report.atmosphere.missing_samples, 3);
        assert_eq!(
            serde_json::to_string(&report).unwrap(),
            serde_json::to_string(&build_fixture_report().unwrap()).unwrap()
        );
    }
}

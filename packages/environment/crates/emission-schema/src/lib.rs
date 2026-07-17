//! Immutable emission-release schema and semantic validation.

use environment_core::{
    DataValidity, DnbDirectionalRadiance, EnvironmentError, StableId, SupportArea,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

pub const FIXTURE_SCHEMA_REVISION: &str = "emission-fixture-v1";
pub const DNB_QUANTITY: &str = "corrected-reference-view-DNB-band-directional-radiance";
pub const DNB_UNIT: &str = "nW cm-2 sr-1";

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct EmissionRelease {
    pub emission_schema_revision: StableId,
    pub emission_model_revision: StableId,
    pub emission_release_id: StableId,
    pub content_license: String,
    pub quantity: String,
    pub unit: String,
    pub reference_view: String,
    pub support: String,
    pub spectrum_status: String,
    pub upward_angular_status: String,
    pub temporal_profile_status: String,
    pub cells: Vec<EmissionCell>,
    pub total_directional_intensity_w_sr: f64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct EmissionCell {
    pub cell_id: StableId,
    pub center_wgs84_deg: [f64; 2],
    pub support_area_m2: f64,
    pub j_dnb_nw_cm2_sr: f64,
    pub directional_intensity_w_sr: f64,
    pub coverage_status: CoverageStatus,
    pub data_validity: DataValidity,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CoverageStatus {
    SupportedEmission,
    SupportedDarkOrUpperBound,
    NoEvidence,
}

impl EmissionRelease {
    pub fn from_json(json: &str) -> Result<Self, EnvironmentError> {
        let release: Self =
            serde_json::from_str(json).map_err(|_| EnvironmentError::InvalidValue)?;
        release.validate()?;
        Ok(release)
    }

    pub fn validate(&self) -> Result<(), EnvironmentError> {
        if self.emission_schema_revision != FIXTURE_SCHEMA_REVISION {
            return Err(EnvironmentError::IncompatibleSchema);
        }
        if self.quantity != DNB_QUANTITY
            || self.unit != DNB_UNIT
            || self.support != "exact-polygon-area"
        {
            return Err(EnvironmentError::InvalidUnits);
        }
        if self.cells.is_empty() || !self.total_directional_intensity_w_sr.is_finite() {
            return Err(EnvironmentError::InvalidValue);
        }

        let mut ids = HashSet::with_capacity(self.cells.len());
        let mut total = 0.0;
        for cell in &self.cells {
            if !ids.insert(&cell.cell_id) {
                return Err(EnvironmentError::DuplicateIdentifier);
            }
            let [longitude, latitude] = cell.center_wgs84_deg;
            if !longitude.is_finite()
                || !latitude.is_finite()
                || !(-180.0..=180.0).contains(&longitude)
                || !(-90.0..=90.0).contains(&latitude)
                || !cell.support_area_m2.is_finite()
                || cell.support_area_m2 <= 0.0
                || !cell.j_dnb_nw_cm2_sr.is_finite()
                || cell.j_dnb_nw_cm2_sr < 0.0
            {
                return Err(EnvironmentError::InvalidValue);
            }
            let expected = DnbDirectionalRadiance(cell.j_dnb_nw_cm2_sr)
                .integrate_support(SupportArea(cell.support_area_m2))
                .0;
            if relative_error(cell.directional_intensity_w_sr, expected) > 1.0e-12 {
                return Err(EnvironmentError::IncompatibleSemantics);
            }
            total += cell.directional_intensity_w_sr;
        }
        if relative_error(total, self.total_directional_intensity_w_sr) > 1.0e-12 {
            return Err(EnvironmentError::IncompatibleSemantics);
        }
        Ok(())
    }
}

fn relative_error(actual: f64, expected: f64) -> f64 {
    (actual - expected).abs() / expected.abs().max(1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../../../../contracts/fixtures/v1/emission-release.json");

    #[test]
    fn decodes_and_validates_fixture_release() {
        let release = EmissionRelease::from_json(FIXTURE).expect("fixture should validate");
        assert_eq!(release.cells.len(), 4);
        assert_eq!(release.total_directional_intensity_w_sr, 70.0);
    }

    #[test]
    fn rejects_semantic_unit_drift() {
        let corrupt = FIXTURE.replace("nW cm-2 sr-1", "W m-2 sr-1");
        assert_eq!(
            EmissionRelease::from_json(&corrupt),
            Err(EnvironmentError::InvalidUnits)
        );
    }
}

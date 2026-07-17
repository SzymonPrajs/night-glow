//! Immutable atmosphere-release schema and semantic validation.

use environment_core::{
    AtmosphereSelectionMode, DataValidity, EnvironmentError, SourceEvidenceClass, StableId,
    UtcInstant, validate_height_pressure_column,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const FIXTURE_SCHEMA_REVISION: &str = "atmosphere-fixture-v1";

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct AtmosphereFieldRelease {
    pub atmosphere_schema_revision: StableId,
    pub atmosphere_model_revision: StableId,
    pub atmosphere_release_id: StableId,
    pub source_run_id: StableId,
    pub content_license: String,
    pub selection: AtmosphereSelection,
    pub axes: AtmosphereAxes,
    pub shape: [usize; 3],
    pub variables: BTreeMap<String, AtmosphereVariable>,
    pub data_validity: DataValidity,
    pub uncertainty_status: StableId,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct AtmosphereSelection {
    pub mode: AtmosphereSelectionMode,
    pub requested_time_utc: UtcInstant,
    pub valid_time_utc: UtcInstant,
    pub standard_scenario_id: StableId,
    pub interpolation_revision: StableId,
    pub downscaling_revision: StableId,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct AtmosphereAxes {
    pub longitude_deg_east: Vec<f64>,
    pub latitude_deg_north: Vec<f64>,
    pub geometric_height_m_above_wgs84_ellipsoid: Vec<f64>,
    pub axis_order: [String; 3],
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct AtmosphereVariable {
    pub unit: String,
    pub wet_dry_basis: String,
    pub evidence: SourceEvidenceClass,
    pub values: Vec<f64>,
}

impl AtmosphereFieldRelease {
    pub fn from_json(json: &str) -> Result<Self, EnvironmentError> {
        let release: Self =
            serde_json::from_str(json).map_err(|_| EnvironmentError::InvalidValue)?;
        release.validate()?;
        Ok(release)
    }

    pub fn validate(&self) -> Result<(), EnvironmentError> {
        if self.atmosphere_schema_revision != FIXTURE_SCHEMA_REVISION {
            return Err(EnvironmentError::IncompatibleSchema);
        }
        if self.selection.mode != AtmosphereSelectionMode::StandardScenario
            || self.selection.requested_time_utc != self.selection.valid_time_utc
        {
            return Err(EnvironmentError::IncompatibleSemantics);
        }
        if self.axes.axis_order != ["latitude", "longitude", "height"] {
            return Err(EnvironmentError::IncompatibleSemantics);
        }
        if self.shape
            != [
                self.axes.latitude_deg_north.len(),
                self.axes.longitude_deg_east.len(),
                self.axes.geometric_height_m_above_wgs84_ellipsoid.len(),
            ]
            || self.shape.contains(&0)
        {
            return Err(EnvironmentError::InvalidShape);
        }
        validate_increasing(&self.axes.longitude_deg_east)?;
        validate_increasing(&self.axes.latitude_deg_north)?;
        validate_increasing(&self.axes.geometric_height_m_above_wgs84_ellipsoid)?;

        let value_count: usize = self.shape.iter().product();
        for variable in self.variables.values() {
            if variable.values.len() != value_count
                || variable.values.iter().any(|value| !value.is_finite())
            {
                return Err(EnvironmentError::InvalidShape);
            }
        }
        let pressure = self
            .variables
            .get("pressure_pa")
            .ok_or(EnvironmentError::IncompatibleSemantics)?;
        if pressure.unit != "Pa" {
            return Err(EnvironmentError::InvalidUnits);
        }
        let height_count = self.shape[2];
        for column in pressure.values.chunks_exact(height_count) {
            validate_height_pressure_column(
                &self.axes.geometric_height_m_above_wgs84_ellipsoid,
                column,
            )
            .map_err(|_| EnvironmentError::IncompatibleSemantics)?;
        }
        Ok(())
    }
}

fn validate_increasing(values: &[f64]) -> Result<(), EnvironmentError> {
    if values.is_empty()
        || values.iter().any(|value| !value.is_finite())
        || values.windows(2).any(|pair| pair[1] <= pair[0])
    {
        return Err(EnvironmentError::InvalidCoordinates);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../../../../contracts/fixtures/v1/atmosphere-release.json");

    #[test]
    fn decodes_and_validates_fixture_release() {
        let release = AtmosphereFieldRelease::from_json(FIXTURE).unwrap();
        assert_eq!(release.shape, [2, 2, 3]);
        assert_eq!(release.variables["pressure_pa"].values.len(), 12);
    }

    #[test]
    fn rejects_pressure_unit_drift() {
        let corrupt = FIXTURE.replacen("\"Pa\"", "\"hPa\"", 1);
        assert_eq!(
            AtmosphereFieldRelease::from_json(&corrupt),
            Err(EnvironmentError::InvalidUnits)
        );
    }
}

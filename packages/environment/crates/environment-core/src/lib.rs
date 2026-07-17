//! Shared Environment quantities and validation primitives.
//!
//! This crate contains no provider ingestion and no light propagation.

use serde::{Deserialize, Serialize};

/// A corrected-reference-view DNB directional radiance in nW cm^-2 sr^-1.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct DnbDirectionalRadiance(pub f64);

/// Exact geographic support area in square metres.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SupportArea(pub f64);

/// Surface-integrated directional intensity in W sr^-1.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct DirectionalIntensity(pub f64);

impl DnbDirectionalRadiance {
    /// Integrates radiance over exact surface support without treating it as
    /// hemispheric flux. One nW cm^-2 equals 1e-5 W m^-2.
    #[must_use]
    pub fn integrate_support(self, support: SupportArea) -> DirectionalIntensity {
        DirectionalIntensity(self.0 * 1.0e-5 * support.0)
    }
}

/// Describes why a numeric cell can or cannot be used.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DataValidity {
    Valid,
    Missing,
    Masked,
    Censored,
    NotCovered,
}

/// WGS84 geodetic bounds used by regional Environment queries.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Wgs84Bounds {
    pub west_deg: f64,
    pub south_deg: f64,
    pub east_deg: f64,
    pub north_deg: f64,
}

impl Wgs84Bounds {
    /// Creates finite, non-wrapping first-slice bounds.
    pub fn new(
        west_deg: f64,
        south_deg: f64,
        east_deg: f64,
        north_deg: f64,
    ) -> Result<Self, EnvironmentError> {
        let values = [west_deg, south_deg, east_deg, north_deg];
        if values.iter().any(|value| !value.is_finite())
            || !(-180.0..=180.0).contains(&west_deg)
            || !(-180.0..=180.0).contains(&east_deg)
            || !(-90.0..=90.0).contains(&south_deg)
            || !(-90.0..=90.0).contains(&north_deg)
            || west_deg > east_deg
            || south_deg > north_deg
        {
            return Err(EnvironmentError::InvalidCoordinates);
        }
        Ok(Self {
            west_deg,
            south_deg,
            east_deg,
            north_deg,
        })
    }

    #[must_use]
    pub fn contains(self, longitude_deg: f64, latitude_deg: f64) -> bool {
        (self.west_deg..=self.east_deg).contains(&longitude_deg)
            && (self.south_deg..=self.north_deg).contains(&latitude_deg)
    }
}

/// Stable top-level Environment failure categories for the first ABI.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EnvironmentError {
    IncompatibleSchema,
    IncompatibleSemantics,
    InvalidUnits,
    InvalidCoordinates,
    InvalidShape,
    InvalidValue,
    DuplicateIdentifier,
    EmptyQuery,
}

/// Errors found while validating a height-pressure column.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ColumnError {
    ShapeMismatch,
    NonFinite,
    NonIncreasingHeight,
    NonDecreasingPressure,
    NonPositivePressure,
}

/// Validates a minimal atmospheric state column while retaining its explicit
/// geometric-height and pressure meanings.
pub fn validate_height_pressure_column(
    geometric_height_m: &[f64],
    pressure_pa: &[f64],
) -> Result<(), ColumnError> {
    if geometric_height_m.is_empty() || geometric_height_m.len() != pressure_pa.len() {
        return Err(ColumnError::ShapeMismatch);
    }
    if geometric_height_m
        .iter()
        .chain(pressure_pa)
        .any(|value| !value.is_finite())
    {
        return Err(ColumnError::NonFinite);
    }
    if pressure_pa.iter().any(|pressure| *pressure <= 0.0) {
        return Err(ColumnError::NonPositivePressure);
    }
    if geometric_height_m.windows(2).any(|pair| pair[1] <= pair[0]) {
        return Err(ColumnError::NonIncreasingHeight);
    }
    if pressure_pa.windows(2).any(|pair| pair[1] >= pair[0]) {
        return Err(ColumnError::NonDecreasingPressure);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn support_integration_preserves_directional_intensity() {
        let cells = [
            (1.0, 1_000_000.0),
            (2.0, 1_000_000.0),
            (0.0, 1_000_000.0),
            (4.0, 1_000_000.0),
        ];
        let total: f64 = cells
            .into_iter()
            .map(|(radiance, area)| {
                DnbDirectionalRadiance(radiance)
                    .integrate_support(SupportArea(area))
                    .0
            })
            .sum();
        assert_eq!(total, 70.0);
    }

    #[test]
    fn atmosphere_column_rejects_hidden_axis_errors() {
        assert_eq!(
            validate_height_pressure_column(
                &[100.0, 1_100.0, 3_100.0],
                &[100_000.0, 88_700.0, 68_300.0]
            ),
            Ok(())
        );
        assert_eq!(
            validate_height_pressure_column(&[100.0, 100.0], &[100_000.0, 90_000.0]),
            Err(ColumnError::NonIncreasingHeight)
        );
        assert_eq!(
            validate_height_pressure_column(&[100.0, 1_100.0], &[90_000.0, 90_000.0]),
            Err(ColumnError::NonDecreasingPressure)
        );
    }
}

//! Lossless-metadata normalization for extracted atmosphere provider variables.

use environment_core::{DataValidity, EnvironmentError, SourceEvidenceClass, StableId, UtcInstant};
use serde::{Deserialize, Serialize};

const STANDARD_GRAVITY_M_S2: f64 = 9.806_65;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ExtractedProviderVariable {
    pub fixture_revision: StableId,
    pub content_license: StableId,
    pub provider: Provider,
    pub collection_id: StableId,
    pub source_run_id: StableId,
    pub source_variable_id: StableId,
    pub valid_time_utc: UtcInstant,
    pub quantity: Quantity,
    pub source_unit: SourceUnit,
    pub vertical_coordinate: VerticalCoordinate,
    pub wet_dry_basis: WetDryBasis,
    pub evidence: SourceEvidenceClass,
    pub missing_value: f64,
    pub values: Vec<f64>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct NormalizedProviderVariable {
    pub provider: Provider,
    pub collection_id: StableId,
    pub source_run_id: StableId,
    pub source_variable_id: StableId,
    pub valid_time_utc: UtcInstant,
    pub quantity: Quantity,
    pub unit: CanonicalUnit,
    pub vertical_coordinate: VerticalCoordinate,
    pub wet_dry_basis: WetDryBasis,
    pub evidence: SourceEvidenceClass,
    pub values: Vec<Option<f64>>,
    pub validity: Vec<DataValidity>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Provider {
    Era5,
    Cams,
    Merra2,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Quantity {
    AirPressure,
    AirTemperature,
    RelativeHumidity,
    GeopotentialHeight,
    AerosolMassMixingRatio,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub enum SourceUnit {
    #[serde(rename = "Pa")]
    Pascal,
    #[serde(rename = "hPa")]
    Hectopascal,
    #[serde(rename = "K")]
    Kelvin,
    #[serde(rename = "%")]
    Percent,
    #[serde(rename = "1")]
    Fraction,
    #[serde(rename = "m2 s-2")]
    Geopotential,
    #[serde(rename = "kg kg-1")]
    KilogramPerKilogram,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CanonicalUnit {
    Pascal,
    Kelvin,
    Fraction,
    MetreGeopotentialHeight,
    KilogramPerKilogram,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum VerticalCoordinate {
    Surface,
    PressureLevel,
    HybridModelLevel,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum WetDryBasis {
    NotApplicable,
    DryMatter,
    AmbientWetState,
}

impl ExtractedProviderVariable {
    pub fn from_json(json: &str) -> Result<Self, EnvironmentError> {
        let variable: Self =
            serde_json::from_str(json).map_err(|_| EnvironmentError::InvalidValue)?;
        variable.validate()?;
        Ok(variable)
    }

    pub fn collection_from_json(json: &str) -> Result<Vec<Self>, EnvironmentError> {
        let variables: Vec<Self> =
            serde_json::from_str(json).map_err(|_| EnvironmentError::InvalidValue)?;
        if variables.is_empty() {
            return Err(EnvironmentError::InvalidValue);
        }
        for variable in &variables {
            variable.validate()?;
        }
        Ok(variables)
    }

    pub fn validate(&self) -> Result<(), EnvironmentError> {
        if self.content_license != "CC0-1.0" || self.values.is_empty() {
            return Err(EnvironmentError::IncompatibleSemantics);
        }
        if !self.missing_value.is_finite()
            || self
                .values
                .iter()
                .any(|value| !value.is_finite() && *value != self.missing_value)
        {
            return Err(EnvironmentError::InvalidValue);
        }
        canonical_unit(self.quantity, self.source_unit)?;
        if self.quantity == Quantity::AerosolMassMixingRatio
            && self.wet_dry_basis == WetDryBasis::NotApplicable
        {
            return Err(EnvironmentError::IncompatibleSemantics);
        }
        Ok(())
    }

    pub fn normalize(&self) -> Result<NormalizedProviderVariable, EnvironmentError> {
        self.validate()?;
        let unit = canonical_unit(self.quantity, self.source_unit)?;
        let mut values = Vec::with_capacity(self.values.len());
        let mut validity = Vec::with_capacity(self.values.len());
        for value in &self.values {
            if *value == self.missing_value {
                values.push(None);
                validity.push(DataValidity::Missing);
            } else {
                let converted = convert(self.quantity, self.source_unit, *value)?;
                values.push(Some(converted));
                validity.push(DataValidity::Valid);
            }
        }
        Ok(NormalizedProviderVariable {
            provider: self.provider,
            collection_id: self.collection_id.clone(),
            source_run_id: self.source_run_id.clone(),
            source_variable_id: self.source_variable_id.clone(),
            valid_time_utc: self.valid_time_utc.clone(),
            quantity: self.quantity,
            unit,
            vertical_coordinate: self.vertical_coordinate,
            wet_dry_basis: self.wet_dry_basis,
            evidence: self.evidence,
            values,
            validity,
        })
    }
}

fn canonical_unit(
    quantity: Quantity,
    source_unit: SourceUnit,
) -> Result<CanonicalUnit, EnvironmentError> {
    match (quantity, source_unit) {
        (Quantity::AirPressure, SourceUnit::Pascal | SourceUnit::Hectopascal) => {
            Ok(CanonicalUnit::Pascal)
        }
        (Quantity::AirTemperature, SourceUnit::Kelvin) => Ok(CanonicalUnit::Kelvin),
        (Quantity::RelativeHumidity, SourceUnit::Percent | SourceUnit::Fraction) => {
            Ok(CanonicalUnit::Fraction)
        }
        (Quantity::GeopotentialHeight, SourceUnit::Geopotential) => {
            Ok(CanonicalUnit::MetreGeopotentialHeight)
        }
        (Quantity::AerosolMassMixingRatio, SourceUnit::KilogramPerKilogram) => {
            Ok(CanonicalUnit::KilogramPerKilogram)
        }
        _ => Err(EnvironmentError::InvalidUnits),
    }
}

fn convert(
    quantity: Quantity,
    source_unit: SourceUnit,
    value: f64,
) -> Result<f64, EnvironmentError> {
    let converted = match (quantity, source_unit) {
        (Quantity::AirPressure, SourceUnit::Pascal) => value,
        (Quantity::AirPressure, SourceUnit::Hectopascal) => value * 100.0,
        (Quantity::AirTemperature, SourceUnit::Kelvin) => value,
        (Quantity::RelativeHumidity, SourceUnit::Percent) => value / 100.0,
        (Quantity::RelativeHumidity, SourceUnit::Fraction) => value,
        (Quantity::GeopotentialHeight, SourceUnit::Geopotential) => value / STANDARD_GRAVITY_M_S2,
        (Quantity::AerosolMassMixingRatio, SourceUnit::KilogramPerKilogram) => value,
        _ => return Err(EnvironmentError::InvalidUnits),
    };
    if !converted.is_finite()
        || matches!(quantity, Quantity::AirPressure) && converted <= 0.0
        || matches!(quantity, Quantity::AirTemperature) && converted <= 0.0
        || matches!(quantity, Quantity::RelativeHumidity) && !(0.0..=1.0).contains(&converted)
        || matches!(quantity, Quantity::AerosolMassMixingRatio) && converted < 0.0
    {
        return Err(EnvironmentError::InvalidValue);
    }
    Ok(converted)
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../../../fixtures/v1/atmosphere-provider-extracts.json");

    fn fixtures() -> Vec<ExtractedProviderVariable> {
        ExtractedProviderVariable::collection_from_json(FIXTURE).unwrap()
    }

    #[test]
    fn normalizes_three_provider_families_without_erasing_metadata() {
        let variables = fixtures();
        assert_eq!(variables.len(), 3);
        let era5 = variables[0].normalize().unwrap();
        assert_eq!(era5.provider, Provider::Era5);
        assert_eq!(era5.unit, CanonicalUnit::Pascal);
        assert_eq!(era5.values, [Some(100_000.0), Some(85_000.0), None]);

        let cams = variables[1].normalize().unwrap();
        assert_eq!(cams.provider, Provider::Cams);
        assert_eq!(cams.values, [Some(0.72), Some(0.45), None]);

        let merra = variables[2].normalize().unwrap();
        assert_eq!(merra.provider, Provider::Merra2);
        assert_eq!(merra.wet_dry_basis, WetDryBasis::DryMatter);
        assert_eq!(merra.values[0], Some(1.5e-8));
    }

    #[test]
    fn rejects_incompatible_quantity_unit_pairs_and_hidden_humidity_growth() {
        let invalid_unit = FIXTURE.replace("\"source_unit\": \"hPa\"", "\"source_unit\": \"K\"");
        let variables: Vec<ExtractedProviderVariable> =
            serde_json::from_str(&invalid_unit).unwrap();
        assert_eq!(variables[0].validate(), Err(EnvironmentError::InvalidUnits));

        let missing_basis = FIXTURE.replace(
            "\"wet_dry_basis\": \"dry-matter\"",
            "\"wet_dry_basis\": \"not-applicable\"",
        );
        let variables: Vec<ExtractedProviderVariable> =
            serde_json::from_str(&missing_basis).unwrap();
        assert_eq!(
            variables[2].validate(),
            Err(EnvironmentError::IncompatibleSemantics)
        );
    }

    #[test]
    fn converts_geopotential_only_to_declared_geopotential_height() {
        assert_eq!(
            convert(
                Quantity::GeopotentialHeight,
                SourceUnit::Geopotential,
                9_806.65,
            )
            .unwrap(),
            1_000.0
        );
    }
}

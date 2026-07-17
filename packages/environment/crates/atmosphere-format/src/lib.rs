//! Regional contiguous queries over validated atmosphere releases.

use atmosphere_schema::AtmosphereFieldRelease;
use environment_core::{EnvironmentError, Wgs84Bounds};
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq)]
pub struct AtmosphereStateVolume {
    pub atmosphere_release_id: String,
    pub source_run_id: String,
    pub selection_mode: String,
    pub valid_time_utc: String,
    pub longitude_deg_east: Vec<f64>,
    pub latitude_deg_north: Vec<f64>,
    pub geometric_height_m: Vec<f64>,
    pub shape: [usize; 3],
    pub variables: BTreeMap<String, StateVariable>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct StateVariable {
    pub unit: String,
    pub wet_dry_basis: String,
    pub evidence: String,
    pub values: Vec<f64>,
}

pub fn query_atmosphere(
    release: &AtmosphereFieldRelease,
    bounds: Wgs84Bounds,
    requested_variables: &[&str],
) -> Result<AtmosphereStateVolume, EnvironmentError> {
    release.validate()?;
    let longitude_indices = indices_in_bounds(&release.axes.longitude_deg_east, |value| {
        (bounds.west_deg..=bounds.east_deg).contains(&value)
    });
    let latitude_indices = indices_in_bounds(&release.axes.latitude_deg_north, |value| {
        (bounds.south_deg..=bounds.north_deg).contains(&value)
    });
    if longitude_indices.is_empty() || latitude_indices.is_empty() {
        return Err(EnvironmentError::EmptyQuery);
    }
    let height_count = release.shape[2];
    let mut variables = BTreeMap::new();
    for name in requested_variables {
        let source = release
            .variables
            .get(*name)
            .ok_or(EnvironmentError::IncompatibleSemantics)?;
        let mut values =
            Vec::with_capacity(latitude_indices.len() * longitude_indices.len() * height_count);
        for latitude in &latitude_indices {
            for longitude in &longitude_indices {
                let offset = (latitude * release.shape[1] + longitude) * height_count;
                values.extend_from_slice(&source.values[offset..offset + height_count]);
            }
        }
        variables.insert(
            (*name).to_owned(),
            StateVariable {
                unit: source.unit.clone(),
                wet_dry_basis: source.wet_dry_basis.clone(),
                evidence: source.evidence.clone(),
                values,
            },
        );
    }
    Ok(AtmosphereStateVolume {
        atmosphere_release_id: release.atmosphere_release_id.clone(),
        source_run_id: release.source_run_id.clone(),
        selection_mode: release.selection.mode.clone(),
        valid_time_utc: release.selection.valid_time_utc.clone(),
        longitude_deg_east: longitude_indices
            .iter()
            .map(|index| release.axes.longitude_deg_east[*index])
            .collect(),
        latitude_deg_north: latitude_indices
            .iter()
            .map(|index| release.axes.latitude_deg_north[*index])
            .collect(),
        geometric_height_m: release
            .axes
            .geometric_height_m_above_wgs84_ellipsoid
            .clone(),
        shape: [
            latitude_indices.len(),
            longitude_indices.len(),
            height_count,
        ],
        variables,
    })
}

fn indices_in_bounds(values: &[f64], predicate: impl Fn(f64) -> bool) -> Vec<usize> {
    values
        .iter()
        .enumerate()
        .filter_map(|(index, value)| predicate(*value).then_some(index))
        .collect()
}

impl AtmosphereStateVolume {
    pub fn mean_surface_pressure_pa(&self) -> Result<f64, EnvironmentError> {
        let pressure = self
            .variables
            .get("pressure_pa")
            .ok_or(EnvironmentError::IncompatibleSemantics)?;
        if pressure.unit != "Pa" {
            return Err(EnvironmentError::InvalidUnits);
        }
        let height_count = self.shape[2];
        let (total, count) = pressure
            .values
            .chunks_exact(height_count)
            .fold((0.0, 0usize), |(sum, count), column| {
                (sum + column[0], count + 1)
            });
        if count == 0 {
            return Err(EnvironmentError::EmptyQuery);
        }
        Ok(total / count as f64)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use atmosphere_schema::AtmosphereFieldRelease;

    const FIXTURE: &str = include_str!("../../../../contracts/fixtures/v1/atmosphere-release.json");

    #[test]
    fn regional_volume_preserves_axes_and_pressure() {
        let release = AtmosphereFieldRelease::from_json(FIXTURE).unwrap();
        let bounds = Wgs84Bounds::new(20.99, 51.99, 21.03, 52.03).unwrap();
        let volume = query_atmosphere(&release, bounds, &["pressure_pa", "temperature_k"]).unwrap();
        assert_eq!(volume.shape, [2, 2, 3]);
        assert_eq!(volume.mean_surface_pressure_pa().unwrap(), 99_850.0);
        assert_eq!(volume.variables["temperature_k"].values.len(), 12);
    }
}

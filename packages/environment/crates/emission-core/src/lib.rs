//! Chunk-oriented emission queries over validated immutable releases.

use emission_schema::{CoverageStatus, EmissionRelease};
use environment_core::{DataValidity, EnvironmentError, Wgs84Bounds};

#[derive(Clone, Debug, PartialEq)]
pub struct SurfaceEmissionBatch {
    pub emission_release_id: String,
    pub cell_ids: Vec<String>,
    pub longitude_deg_east: Vec<f64>,
    pub latitude_deg_north: Vec<f64>,
    pub support_area_m2: Vec<f64>,
    pub directional_intensity_w_sr: Vec<f64>,
    pub coverage_status: Vec<CoverageStatus>,
    pub data_validity: Vec<DataValidity>,
}

impl SurfaceEmissionBatch {
    #[must_use]
    pub fn len(&self) -> usize {
        self.cell_ids.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.cell_ids.is_empty()
    }

    #[must_use]
    pub fn total_directional_intensity_w_sr(&self) -> f64 {
        self.directional_intensity_w_sr.iter().sum()
    }
}

pub fn query_emission(
    release: &EmissionRelease,
    bounds: Wgs84Bounds,
) -> Result<SurfaceEmissionBatch, EnvironmentError> {
    release.validate()?;
    let selected: Vec<_> = release
        .cells
        .iter()
        .filter(|cell| bounds.contains(cell.center_wgs84_deg[0], cell.center_wgs84_deg[1]))
        .collect();
    if selected.is_empty() {
        return Err(EnvironmentError::EmptyQuery);
    }
    Ok(SurfaceEmissionBatch {
        emission_release_id: release.emission_release_id.clone(),
        cell_ids: selected.iter().map(|cell| cell.cell_id.clone()).collect(),
        longitude_deg_east: selected
            .iter()
            .map(|cell| cell.center_wgs84_deg[0])
            .collect(),
        latitude_deg_north: selected
            .iter()
            .map(|cell| cell.center_wgs84_deg[1])
            .collect(),
        support_area_m2: selected.iter().map(|cell| cell.support_area_m2).collect(),
        directional_intensity_w_sr: selected
            .iter()
            .map(|cell| cell.directional_intensity_w_sr)
            .collect(),
        coverage_status: selected.iter().map(|cell| cell.coverage_status).collect(),
        data_validity: selected.iter().map(|cell| cell.data_validity).collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use emission_schema::EmissionRelease;

    const FIXTURE: &str = include_str!("../../../../contracts/fixtures/v1/emission-release.json");

    #[test]
    fn regional_batch_is_contiguous_and_conservative() {
        let release = EmissionRelease::from_json(FIXTURE).unwrap();
        let bounds = Wgs84Bounds::new(20.99, 51.99, 21.03, 52.03).unwrap();
        let batch = query_emission(&release, bounds).unwrap();
        assert_eq!(batch.len(), 4);
        assert_eq!(batch.total_directional_intensity_w_sr(), 70.0);
        assert_eq!(batch.cell_ids, ["sw", "se", "nw", "ne"]);
    }
}

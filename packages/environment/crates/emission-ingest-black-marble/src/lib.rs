//! Metadata-driven normalization for extracted VNP46A2 Collection 2 samples.

use environment_core::{DataValidity, EnvironmentError, StableId};
use serde::{Deserialize, Serialize};

const PRODUCT: &str = "VNP46A2";
const COLLECTION: &str = "2";
const RADIANCE_UNIT: &str = "nW cm-2 sr-1";
const RADIANCE_FILL: f64 = -999.9;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ExtractedGranule {
    pub fixture_revision: StableId,
    pub product_short_name: StableId,
    pub collection: StableId,
    pub source_granule_id: StableId,
    pub content_license: StableId,
    pub metadata: ExtractedMetadata,
    pub pixels: Vec<ExtractedPixel>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ExtractedMetadata {
    pub direct_radiance: NumericMetadata,
    pub gap_filled_radiance: NumericMetadata,
    pub mandatory_quality_fill: u8,
    pub snow_fill: u8,
    pub cloud_mask_fill: u16,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct NumericMetadata {
    pub sds_name: String,
    pub unit: String,
    pub fill_value: f64,
    pub scale_factor: f64,
    pub offset: f64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ExtractedPixel {
    pub pixel_id: StableId,
    pub direct_radiance: f64,
    pub gap_filled_radiance: f64,
    pub mandatory_quality: u8,
    pub latest_high_quality_retrieval_days: u8,
    pub snow_flag: u8,
    pub cloud_mask: u16,
}

#[derive(Clone, Debug, PartialEq)]
pub struct NormalizedPixel {
    pub pixel_id: StableId,
    pub direct_radiance_nw_cm2_sr: Option<f64>,
    pub gap_filled_radiance_nw_cm2_sr: Option<f64>,
    pub retrieval_quality: RetrievalQuality,
    pub latest_high_quality_retrieval_days: Option<u8>,
    pub snow_state: SnowState,
    pub cloud_mask: Option<CloudMask>,
    pub data_validity: DataValidity,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RetrievalQuality {
    HighQuality,
    PoorOutlierOrPotentialCloud,
    PoorHighSolarZenith,
    PoorLunarEclipse,
    PoorAurora,
    PoorGlint,
    NoRetrieval,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SnowState {
    SnowFree,
    SnowOrIce,
    Missing,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CloudMask {
    pub is_day: bool,
    pub mask_quality: u8,
    pub confidence: u8,
    pub shadow: bool,
    pub cirrus: bool,
    pub snow_or_ice: bool,
    pub aurora: bool,
    pub lunar_eclipse: bool,
}

impl ExtractedGranule {
    pub fn from_json(json: &str) -> Result<Self, EnvironmentError> {
        let granule: Self =
            serde_json::from_str(json).map_err(|_| EnvironmentError::InvalidValue)?;
        granule.validate()?;
        Ok(granule)
    }

    pub fn validate(&self) -> Result<(), EnvironmentError> {
        if self.product_short_name != PRODUCT || self.collection != COLLECTION {
            return Err(EnvironmentError::IncompatibleSchema);
        }
        if self.content_license != "CC0-1.0" {
            return Err(EnvironmentError::IncompatibleSemantics);
        }
        validate_radiance_metadata(&self.metadata.direct_radiance, "DNB_BRDF-Corrected_NTL")?;
        validate_radiance_metadata(
            &self.metadata.gap_filled_radiance,
            "Gap_Filled_DNB_BRDF-Corrected_NTL",
        )?;
        if self.metadata.mandatory_quality_fill != 255
            || self.metadata.snow_fill != 255
            || self.metadata.cloud_mask_fill != 65_535
            || self.pixels.is_empty()
        {
            return Err(EnvironmentError::IncompatibleSemantics);
        }
        Ok(())
    }

    pub fn normalize(&self) -> Result<Vec<NormalizedPixel>, EnvironmentError> {
        self.validate()?;
        self.pixels.iter().map(normalize_pixel).collect()
    }
}

fn validate_radiance_metadata(
    metadata: &NumericMetadata,
    expected_name: &str,
) -> Result<(), EnvironmentError> {
    if metadata.sds_name != expected_name
        || metadata.unit != RADIANCE_UNIT
        || metadata.fill_value != RADIANCE_FILL
        || metadata.scale_factor != 1.0
        || metadata.offset != 0.0
    {
        return Err(EnvironmentError::InvalidUnits);
    }
    Ok(())
}

fn normalize_pixel(pixel: &ExtractedPixel) -> Result<NormalizedPixel, EnvironmentError> {
    let direct = normalize_radiance(pixel.direct_radiance)?;
    let gap_filled = normalize_radiance(pixel.gap_filled_radiance)?;
    let retrieval_quality = match pixel.mandatory_quality {
        0 => RetrievalQuality::HighQuality,
        1 => RetrievalQuality::PoorOutlierOrPotentialCloud,
        2 => RetrievalQuality::PoorHighSolarZenith,
        3 => RetrievalQuality::PoorLunarEclipse,
        4 => RetrievalQuality::PoorAurora,
        5 => RetrievalQuality::PoorGlint,
        255 => RetrievalQuality::NoRetrieval,
        _ => return Err(EnvironmentError::IncompatibleSemantics),
    };
    let snow_state = match pixel.snow_flag {
        0 => SnowState::SnowFree,
        1 => SnowState::SnowOrIce,
        255 => SnowState::Missing,
        _ => return Err(EnvironmentError::IncompatibleSemantics),
    };
    let cloud_mask = (pixel.cloud_mask != 65_535).then(|| decode_cloud_mask(pixel.cloud_mask));
    if retrieval_quality == RetrievalQuality::NoRetrieval && direct.is_some() {
        return Err(EnvironmentError::IncompatibleSemantics);
    }
    Ok(NormalizedPixel {
        pixel_id: pixel.pixel_id.clone(),
        direct_radiance_nw_cm2_sr: direct,
        gap_filled_radiance_nw_cm2_sr: gap_filled,
        retrieval_quality,
        latest_high_quality_retrieval_days: (pixel.latest_high_quality_retrieval_days != 255)
            .then_some(pixel.latest_high_quality_retrieval_days),
        snow_state,
        cloud_mask,
        data_validity: if direct.is_some() || gap_filled.is_some() {
            DataValidity::Valid
        } else {
            DataValidity::Missing
        },
    })
}

fn normalize_radiance(value: f64) -> Result<Option<f64>, EnvironmentError> {
    if value == RADIANCE_FILL {
        Ok(None)
    } else if value.is_finite() && value >= 0.0 {
        Ok(Some(value))
    } else {
        Err(EnvironmentError::InvalidValue)
    }
}

#[must_use]
pub const fn decode_cloud_mask(value: u16) -> CloudMask {
    CloudMask {
        is_day: value & 1 != 0,
        mask_quality: ((value >> 4) & 0b11) as u8,
        confidence: ((value >> 6) & 0b11) as u8,
        shadow: value & (1 << 8) != 0,
        cirrus: value & (1 << 9) != 0,
        snow_or_ice: value & (1 << 10) != 0,
        aurora: value & (1 << 12) != 0,
        lunar_eclipse: value & (1 << 13) != 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../../../fixtures/v1/black-marble-vnp46a2-extract.json");

    #[test]
    fn normalizes_every_collection_two_quality_state_without_selecting_a_fallback() {
        let granule = ExtractedGranule::from_json(FIXTURE).unwrap();
        let pixels = granule.normalize().unwrap();
        assert_eq!(pixels.len(), 7);
        assert_eq!(pixels[0].retrieval_quality, RetrievalQuality::HighQuality);
        assert_eq!(pixels[0].direct_radiance_nw_cm2_sr, Some(12.5));
        assert_eq!(
            pixels[1].retrieval_quality,
            RetrievalQuality::PoorOutlierOrPotentialCloud
        );
        assert_eq!(pixels[4].retrieval_quality, RetrievalQuality::PoorAurora);
        assert_eq!(pixels[6].retrieval_quality, RetrievalQuality::NoRetrieval);
        assert_eq!(pixels[6].direct_radiance_nw_cm2_sr, None);
        assert_eq!(pixels[6].gap_filled_radiance_nw_cm2_sr, Some(8.0));
    }

    #[test]
    fn rejects_silent_scale_or_unit_drift() {
        let scaled = FIXTURE.replace("\"scale_factor\": 1.0", "\"scale_factor\": 0.1");
        assert_eq!(
            ExtractedGranule::from_json(&scaled),
            Err(EnvironmentError::InvalidUnits)
        );
        let watts = FIXTURE.replace("nW cm-2 sr-1", "W m-2 sr-1");
        assert_eq!(
            ExtractedGranule::from_json(&watts),
            Err(EnvironmentError::InvalidUnits)
        );
    }

    #[test]
    fn decodes_cloud_mask_bits_without_merging_them_into_retrieval_quality() {
        let mask = decode_cloud_mask((3 << 4) | (2 << 6) | (1 << 8) | (1 << 12));
        assert_eq!(mask.mask_quality, 3);
        assert_eq!(mask.confidence, 2);
        assert!(mask.shadow && mask.aurora);
        assert!(!mask.is_day && !mask.cirrus && !mask.lunar_eclipse);
    }
}

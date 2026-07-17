//! Thin raw Wasm ABI over canonical Environment fixture operations.

use environment_core::{DnbDirectionalRadiance, SupportArea, validate_height_pressure_column};
use std::cell::RefCell;

thread_local! {
    static INPUT: RefCell<Vec<f64>> = const { RefCell::new(Vec::new()) };
    static SUMMARY: RefCell<Vec<f64>> = const { RefCell::new(Vec::new()) };
}

#[unsafe(no_mangle)]
pub extern "C" fn nightglow_environment_abi_revision() -> u32 {
    1
}

#[unsafe(no_mangle)]
pub extern "C" fn nightglow_fixture_emission_total(
    support_area_m2: f64,
    radiance_0: f64,
    radiance_1: f64,
    radiance_2: f64,
    radiance_3: f64,
) -> f64 {
    [radiance_0, radiance_1, radiance_2, radiance_3]
        .into_iter()
        .map(|radiance| {
            DnbDirectionalRadiance(radiance)
                .integrate_support(SupportArea(support_area_m2))
                .0
        })
        .sum()
}

#[unsafe(no_mangle)]
pub extern "C" fn nightglow_validate_three_level_column(
    height_0: f64,
    height_1: f64,
    height_2: f64,
    pressure_0: f64,
    pressure_1: f64,
    pressure_2: f64,
) -> u32 {
    u32::from(
        validate_height_pressure_column(
            &[height_0, height_1, height_2],
            &[pressure_0, pressure_1, pressure_2],
        )
        .is_ok(),
    )
}

/// Allocates a coarse input buffer owned by this module until the next call.
#[unsafe(no_mangle)]
pub extern "C" fn nightglow_environment_input_allocate(length: u32) -> usize {
    INPUT.with(|input| {
        let mut input = input.borrow_mut();
        input.resize(length as usize, 0.0);
        input.as_mut_ptr() as usize
    })
}

/// Summarizes one field-sized fixture buffer.
///
/// Layout: DNB radiances, support areas, heights, then pressure columns. The
/// returned two-f64 view is total directional intensity and mean surface
/// pressure. Zero means descriptor or column validation failed.
#[unsafe(no_mangle)]
pub extern "C" fn nightglow_environment_summarize_fixture(
    cell_count: u32,
    column_count: u32,
    height_count: u32,
) -> usize {
    let cell_count = cell_count as usize;
    let column_count = column_count as usize;
    let height_count = height_count as usize;
    let expected = cell_count * 2 + height_count + column_count * height_count;
    INPUT.with(|input| {
        let input = input.borrow();
        if cell_count == 0 || column_count == 0 || height_count == 0 || input.len() != expected {
            return 0;
        }
        let radiances = &input[..cell_count];
        let support = &input[cell_count..cell_count * 2];
        let heights = &input[cell_count * 2..cell_count * 2 + height_count];
        let pressures = &input[cell_count * 2 + height_count..];
        if radiances
            .iter()
            .chain(support)
            .any(|value| !value.is_finite())
            || radiances.iter().any(|value| *value < 0.0)
            || support.iter().any(|value| *value <= 0.0)
            || pressures
                .chunks_exact(height_count)
                .any(|column| validate_height_pressure_column(heights, column).is_err())
        {
            return 0;
        }
        let intensity = radiances
            .iter()
            .zip(support)
            .map(|(radiance, area)| {
                DnbDirectionalRadiance(*radiance)
                    .integrate_support(SupportArea(*area))
                    .0
            })
            .sum();
        let mean_surface_pressure = pressures
            .chunks_exact(height_count)
            .map(|column| column[0])
            .sum::<f64>()
            / column_count as f64;
        SUMMARY.with(|summary| {
            let mut summary = summary.borrow_mut();
            summary.clear();
            summary.extend_from_slice(&[intensity, mean_surface_pressure]);
            summary.as_ptr() as usize
        })
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn nightglow_environment_summary_len() -> u32 {
    SUMMARY.with(|summary| u32::try_from(summary.borrow().len()).unwrap_or(0))
}

#[unsafe(no_mangle)]
pub extern "C" fn nightglow_environment_input_len() -> u32 {
    INPUT.with(|input| u32::try_from(input.borrow().len()).unwrap_or(0))
}

/// Releases the current field and summary views. Wasm linear memory may retain
/// capacity for reuse, but no completed request remains addressable.
#[unsafe(no_mangle)]
pub extern "C" fn nightglow_environment_release_buffers() {
    INPUT.with(|input| input.borrow_mut().clear());
    SUMMARY.with(|summary| summary.borrow_mut().clear());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exports_match_fixture_summary() {
        assert_eq!(
            nightglow_fixture_emission_total(1_000_000.0, 1.0, 2.0, 0.0, 4.0),
            70.0
        );
        assert_eq!(
            nightglow_validate_three_level_column(
                100.0, 1_100.0, 3_100.0, 100_000.0, 88_700.0, 68_300.0
            ),
            1
        );
    }

    #[test]
    fn coarse_buffer_summary_validates_every_column() {
        let values = [
            1.0,
            2.0,
            0.0,
            4.0,
            1_000_000.0,
            1_000_000.0,
            1_000_000.0,
            1_000_000.0,
            100.0,
            1_100.0,
            3_100.0,
            100_000.0,
            88_700.0,
            68_300.0,
            99_900.0,
            88_600.0,
            68_200.0,
            99_800.0,
            88_500.0,
            68_100.0,
            99_700.0,
            88_400.0,
            68_000.0,
        ];
        INPUT.with(|input| *input.borrow_mut() = values.to_vec());
        let pointer = nightglow_environment_summarize_fixture(4, 4, 3);
        assert_ne!(pointer, 0);
        SUMMARY.with(|summary| assert_eq!(&*summary.borrow(), &[70.0, 99_850.0]));
        nightglow_environment_release_buffers();
        assert_eq!(nightglow_environment_input_len(), 0);
        assert_eq!(nightglow_environment_summary_len(), 0);
    }
}

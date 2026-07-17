//! Time-data resolution for the synthetic first slice.
//!
//! This package owns astronomy/time semantics. The fixture deliberately resolves
//! only a pinned UTC instant and its frozen Earth-orientation/leap-second inputs;
//! it does not claim an ephemeris or apparent-place implementation.

use nightglow_core::{ObserverScenario, PhysicsError, ResolvedAstronomyTime};

pub fn resolve_time_state(
    scenario: &ObserverScenario,
) -> Result<ResolvedAstronomyTime, PhysicsError> {
    scenario.validate()?;
    if scenario.astronomy_time_data_ids.earth_orientation != "fixture-ut1-equals-utc"
        || scenario.astronomy_time_data_ids.leap_seconds != "fixture-tai-utc-2017-01-01"
    {
        return Err(PhysicsError::IncompatibleSemantics);
    }
    Ok(ResolvedAstronomyTime {
        requested_time_utc: scenario.requested_time_utc.clone(),
        earth_orientation_id: scenario.astronomy_time_data_ids.earth_orientation.clone(),
        leap_seconds_id: scenario.astronomy_time_data_ids.leap_seconds.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use nightglow_core::StableId;

    const SCENARIO: &str = include_str!("../../../../contracts/fixtures/v1/observer-scenario.json");

    #[test]
    fn resolves_only_the_pinned_fixture_time_data() {
        let scenario = ObserverScenario::from_json(SCENARIO).unwrap();
        let time = resolve_time_state(&scenario).unwrap();
        assert_eq!(time.requested_time_utc, "2024-01-15T00:00:00Z");
        assert_eq!(time.earth_orientation_id, "fixture-ut1-equals-utc");
    }

    #[test]
    fn rejects_unpinned_earth_orientation_data() {
        let mut scenario = ObserverScenario::from_json(SCENARIO).unwrap();
        scenario.astronomy_time_data_ids.earth_orientation = StableId::new("latest").unwrap();
        assert_eq!(
            resolve_time_state(&scenario),
            Err(PhysicsError::IncompatibleSemantics)
        );
    }
}

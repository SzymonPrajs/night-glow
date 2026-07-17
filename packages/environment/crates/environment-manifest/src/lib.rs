//! Optional compatibility manifest over independent Environment releases.

use atmosphere_schema::AtmosphereFieldRelease;
use emission_schema::EmissionRelease;
use environment_core::EnvironmentError;

#[derive(Clone, Debug, PartialEq)]
pub struct EnvironmentReleaseSet {
    pub manifest_schema_revision: String,
    pub release_set_id: String,
    pub emission_release_id: String,
    pub atmosphere_release_id: String,
}

impl EnvironmentReleaseSet {
    pub fn validate(
        &self,
        emission: &EmissionRelease,
        atmosphere: &AtmosphereFieldRelease,
    ) -> Result<(), EnvironmentError> {
        if self.manifest_schema_revision != "environment-manifest-fixture-v1" {
            return Err(EnvironmentError::IncompatibleSchema);
        }
        if self.emission_release_id != emission.emission_release_id
            || self.atmosphere_release_id != atmosphere.atmosphere_release_id
        {
            return Err(EnvironmentError::IncompatibleSemantics);
        }
        emission.validate()?;
        atmosphere.validate()?;
        Ok(())
    }
}

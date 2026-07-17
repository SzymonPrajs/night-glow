# Clouds

Owns water/ice cloud optical properties, geometrical support, coverage, and sub-grid assumptions.

Inputs: geolocated cloud fraction, condensate/hydrometeors, liquid/ice water, effective radius or named closure, coverage/overlap, vertical/time support and uncertainty from `AtmosphereStateVolume`, plus wavelength basis. Outputs: extinction, single-scattering albedo, phase representation, spatial mask/statistics, and uncertainty.

Clouds are not an opacity multiplier: they scatter Moon, city light, and twilight, often dominating the result. Research must cover liquid versus ice optics, delta scaling, 1D versus broken-cloud geometry, multiple scattering, cloud-base reflection of artificial light, and conservative interpolation across optical depth. Missing cloud microphysics cannot silently mean clear sky; a closure or scenario is explicit and revisioned. See the [Environment contract](../../../../docs/contracts/environment.md).

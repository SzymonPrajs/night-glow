# Clouds

Owns water/ice cloud optical properties, geometrical support, coverage, and sub-grid assumptions.

Inputs: layer/base/top, liquid/ice water path, effective radius or cloud class, coverage/overlap, wavelength basis. Outputs: extinction, single-scattering albedo, phase representation, spatial mask/statistics, and uncertainty.

Clouds are not an opacity multiplier: they scatter Moon, city light, and twilight, often dominating the result. Research must cover liquid versus ice optics, delta scaling, 1D versus broken-cloud geometry, multiple scattering, cloud-base reflection of artificial light, and conservative interpolation across optical depth.

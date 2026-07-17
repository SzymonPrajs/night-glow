# Surface BRDF

Owns wavelength- and angle-dependent reflection/emission at the lower boundary: land, vegetation, urban surfaces, water, snow, and ice.

Inputs: material/land-cover state, BRDF parameters, spectral basis, illumination/view geometry, optional wind/snow state. Outputs: reflected radiance operator, hemispherical albedo diagnostics, and uncertainty.

A Lambertian albedo is the minimum/reference fixture, not the final global model. Research must address MODIS/VIIRS kernel BRDFs, night-time applicability, ocean Fresnel/glint and waves, snow anisotropy, mixtures, emissive versus reflective city surfaces, and energy-conserving interpolation.

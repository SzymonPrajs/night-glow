# Aerosols

Owns aerosol extinction, single-scattering albedo, phase matrices/functions, and humidity-dependent evolution.

Inputs: aerosol species/bin state, optional source optical diagnostics, relative humidity and explicit ambient-wet/dry convention from an `AtmosphereStateVolume`, plus wavelength basis. Outputs: per-cell/layer extinction/scattering/absorption, phase representation, asymmetry, `DataValidity`, uncertainty and model/closure diagnostics.

Research must distinguish urban, rural, maritime, desert, smoke, and volcanic regimes; investigate Mie/T-matrix or tabulated properties, hygroscopic growth, vertical distribution, mixtures, and strongly forward-peaked numerical treatment. PM/AOD/visibility alone and Ångström-only RGB scaling are not reference optical states. Tests explicitly prevent double humidity growth when provider optics are already ambient-wet and prevent missing aerosol from becoming clean air. See the [Environment contract](../../../../docs/contracts/environment.md).

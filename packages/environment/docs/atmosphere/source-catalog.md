# Atmospheric source catalogue

Statuses: **baseline** is required; **forecast** serves current/future lead times; **cross-check** tests structural uncertainty; **constraint** may correct/validate but cannot fill the globe; **prior** is used only when stronger evidence is absent.

## A. Global meteorology and composition

| Source | Coverage and cadence | Useful variables | Role and limitations | Licence/access |
| --- | --- | --- | --- | --- |
| [ERA5 complete](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-complete) | Global, hourly, 1940–present; ~31 km; 137 model levels / 37 pressure levels | temperature, pressure/geopotential, humidity, wind, cloud fraction/liquid/ice, ozone, boundary-layer fields | **Baseline historical meteorology.** Stable reanalysis; too coarse for street/city plumes and not the preferred aerosol composition record | Dataset page states CC-BY; registered CDS retrieval |
| [CAMS global composition forecast](https://ads.atmosphere.copernicus.eu/datasets/cams-global-atmospheric-composition-forecasts) | Global, 0.4° delivery; twice daily; five-day forecast; 1-hour single-level / 3-hour multi-level; 137 model levels in current era | seven aerosol families/bins, PM1/2.5/10, RH, clouds, boundary layer, gases, AOD, 3-D extinction 355/532/1064 nm, spectral SSA and asymmetry | **Baseline operational composition/forecast.** Model upgrades break homogeneity; retain run/system version and lead | Copernicus dataset/CC-BY terms and attribution |
| [CAMS EAC4 global reanalysis](https://ads.atmosphere.copernicus.eu/datasets/cams-global-reanalysis-eac4-monthly) | Global, 2003 onward; 0.75° published grid; surface/column/25 pressure levels; monthly page plus subdaily products | aerosol species, PM, AOD, gases, RH and meteorology | **Baseline composition climatology/reanalysis.** Coarse; monthly products are insufficient for event reconstruction, so use subdaily entry where required | Copernicus/ADS CC-BY per dataset |
| [MERRA-2](https://gmao.gsfc.nasa.gov/gmao-products/merra-2/) | Global, 1980 onward; 0.5° × 0.625°; 72 native / 42 pressure levels; 3-hourly 3-D | meteorology, aerosol species/bins, AOD and aerosol diagnostics | **Cross-check historical aerosol backbone.** Independent model/assimilation; ~50 km cannot resolve city plumes | NASA Earthdata generally CC0 unless marked; cite each collection DOI |
| [ECMWF open IFS/AIFS](https://www.ecmwf.int/en/forecasts/datasets/open-data) | Global, current medium range to 15 days; core delivery 0.25° with expanding native access | pressure-level meteorology, surface/cloud/water fields, ensembles | **Forecast alternative/meteorological ensemble.** Open subset/access cadence changes; composition still needed | CC BY 4.0 plus ECMWF terms/attribution |
| [NOAA GFS](https://www.nco.ncep.noaa.gov/pmb/products/gfs/nomads/) | Global 0.25° output, 4 runs/day; hourly to 120 h, 3-hourly to 384 h; model ~13 km/127 layers | temperature, RH/specific humidity, wind, cloud water/ice/rain/snow, ozone, boundary-layer height | **Forecast fallback/cross-check.** Pressure-grid output and evolving model; not a full aerosol composition forecast | US government/public data; verify each mirror's terms |
| [NOAA GEFS](https://www.emc.ncep.noaa.gov/emc/pages/numerical_forecast_systems/gefs.php) | Global 31-member ensemble to 16 days (extended run longer); ~25 km/64 levels | meteorological uncertainty; aerosol model products where operationally available | **Ensemble uncertainty/candidate aerosol forecast.** Product availability and validation need a focused probe | NOAA public access; cite product/version |

## B. Regional air quality

| Source | Coverage | Use | Limits |
| --- | --- | --- | --- |
| [CAMS European air-quality forecasts](https://ads.atmosphere.copernicus.eu/datasets/cams-europe-air-quality-forecasts) | Europe, 0.1° (~10 km), daily analysis plus four-day forecast, eleven-model ensemble | European PM/gas detail, ensemble median and spread, station-assimilated analysis | Mostly surface/selected vertical products; regional boundary/model changes; not global |
| CAMS European reanalysis | Europe, multi-year regional ensemble/reanalysis | Higher-resolution climatology and historical European cases | Version and variable availability must be frozen in a feasibility manifest |
| National open models (for example DWD ICON-EU/ICON-D2) | Country/region-specific, kilometre-scale | Optional enrichment for meteorology/clouds | Licences, variable completeness and retention differ; never a global dependency |
| NOAA HRRR/air-quality regional products | United States, kilometre-scale, short horizon | Optional US meteorology/plume enrichment | Domain-limited and rapidly versioned |

Regional products replace a global posterior only inside declared support and after seam/bias validation. They do not overwrite global lineage.

## C. Ground observations

| Source | Measures | Role | Caveat |
| --- | --- | --- | --- |
| [AERONET](https://aeronet.gsfc.nasa.gov/) | public-domain spectral AOD, Ångström information, precipitable water; inversion size distribution, refractive index, SSA, phase/asymmetry where quality permits; provisional lunar AOD | **Constraint/validation** of column aerosol and optics; climatology at sites | Sparse; mostly daytime and clear-sky; inversion has strict AOD/geometry requirements; lunar data cannot supply full inversions |
| [EEA AQ e-Reporting](https://aqportal.discomap.eea.europa.eu/download-data/) | hourly verified/unverified PM2.5, PM10, NO2, O3, SO2, CO plus station type/area | **Constraint/validation** and urban/rural bias assessment in Europe | Surface point representativeness; preliminary stream unverified; licence metadata/version snapshots required |
| [US EPA AQS](https://aqs.epa.gov/aqsweb/documents/ramltohtml.html) | regulatory hourly/daily pollutant and PM/speciation observations | **Constraint/validation** in US; supports composition/extinction tests | Surface network and method changes; not globally representative |
| [OpenAQ](https://docs.openaq.org/about/about) | global aggregation of publicly available criteria pollutants and some RH/temperature | Discovery and conditional station adapter | Each source retains separate third-party licence; OpenAQ warns users to verify it. Never bulk-redistribute blindly |
| NOAA ISD / IGRA radiosondes | surface meteorology / vertical soundings | Meteorological validation, boundary profiles | Station sampling, reporting and redistribution details require collection-specific review |

Station correction is residual-based and representativeness-aware. A traffic kerbside PM monitor cannot set the concentration of a 10 km × vertical column.

## D. Satellite and lidar constraints

| Source | Resolution/quantity | Role | Fundamental limitation |
| --- | --- | --- | --- |
| MODIS/VIIRS MAIAC AOD | ~1 km column AOD with cloud/QA products | Local column constraint and spatial aerosol pattern | Daylight/clear-sky retrieval; column, not vertical profile; surface-reflectance bias |
| [CALIPSO/CALIOP final aerosol profiles](https://forum.earthdata.nasa.gov/viewtopic.php?t=7917) | 5 km along-track aerosol/cloud profiles; extinction/backscatter and feature classification | Vertical-profile climatology/validation | Narrow orbital curtain and sampling; retrieval/lidar-ratio uncertainty; mission-period gaps |
| [EarthCARE ATLID/CPR](https://visuals.earth.esa.int/satellites/earthcare) | 355-nm lidar aerosol/thin-cloud profiles plus 94-GHz cloud radar | Modern vertical aerosol/cloud validation and future assimilation research | Track sampling, young product maturity, access/licence/version audit needed |
| [Sentinel-5P aerosol layer height](https://sentinels.copernicus.eu/data-products/-/asset_publisher/fp37fc19FN8F/content/tropomi-level-2-aerosol-layer-height) | ~3.5 × 7 km, absorbing elevated layer height in cloud-free scenes | Dust/smoke/ash layer-height constraint | Not general boundary-layer PM or full extinction profile |
| [GOES-R cloud products](https://goes-r.noaa.gov/products/overview.html) | high-cadence regional cloud top, optical depth, phase/particle-size products | Americas cloud constraint/validation, including some night products | Geostationary domain/zenith-angle limits; cloud top/optical depth do not uniquely define 3-D cloud |
| NOAA PATMOS-x cloud CDR | daily global AVHRR cloud properties, 1979 onward | Cloud climatology cross-check | Satellite/retrieval changes and limited vertical detail |
| OMPS limb aerosol profiles | multi-wavelength stratospheric extinction, ~1.8 km vertical | Stratospheric/volcanic aerosol constraint | Sparse limb profiles; weak lower-troposphere applicability |

## E. Emission inventories and contextual priors

| Source | Use | Rule |
| --- | --- | --- |
| [CAMS global emission inventories](https://ads.atmosphere.copernicus.eu/datasets/cams-global-emission-inventories) | 0.1° anthropogenic/ship/volcanic and coarser natural sector emissions; precursors, BC/OC and gases | Prior/driver evidence, not atmospheric concentration; CC-BY dataset |
| [EDGAR air pollutants](https://edgar.jrc.ec.europa.eu/dataset_ap81) / HTAP mosaic | 0.1° monthly/annual PM2.5, PM10, BC, OC, SO2, NOx, NH3 by sector | Conditional urban/industrial/transport prior and cross-check; not a replacement for chemistry/transport |
| [CAMS GFAS](https://ads.atmosphere.copernicus.eu/datasets/cams-global-fire-emissions-gfas) | 0.1° daily fire emissions and estimated plume injection height | Smoke event prior and validation context |
| [GHSL](https://human-settlement.emergency.copernicus.eu/faq.php) | open built-up, population, urban morphology/height classes | Representativeness/regime prior where model resolution is coarse; never a pollutant measurement |
| Terrain/land-cover/road/industry layers | downscaling covariates | May redistribute a model residual under conservation; cannot create unbounded mass |

## F. Climatology and standard fallback

- Build the primary climatology from pinned ERA5 meteorology and CAMS/MERRA-2 composition over a declared baseline period, stratified by season and local time with joint covariance/quantiles.
- Use [C3S seasonal forecasts](https://cds.climate.copernicus.eu/datasets/seasonal-original-pressure-levels) only as probabilistic anomalies; official guidance stresses bias correction and that they are not local deterministic weather.
- Use the public [U.S. Standard Atmosphere 1976](https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/19770009539.pdf) only as an explicit no-local-evidence molecular profile. It contains no local aerosol/cloud truth.
- Existing app presets remain regression fixtures and named user scenarios. They are never silently substituted for a place/date.

## G. Admission gate

Every adapter must freeze product/version/run, physical meaning, native support, QA, vertical coordinate, update delay, retention, authentication, access limits, licence, attribution, redistributability, checksums and a legally reusable fixture. API availability does not imply permission to redistribute provider data in Night Glow releases.


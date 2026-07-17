# 15. Research bibliography and data access

Access checked 17 July 2026. Prefer the linked primary landing pages and product guides over third-party mirrors.

## Nighttime radiance

- NASA LAADS DAAC, [VNP46A2 Collection 2 product page](https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/VNP46A2). Daily global 15-arc-second corrected radiance, QA layers, dates, format, and provenance.
- NASA, [Black Marble Collection 2 User Guide (December 2024)](https://landweb.modaps.eosdis.nasa.gov/data/userguide/BlackMarbleUserGuide_Collection2.0_20241203.pdf). Product algorithms, SDS layers, surface-radiance equation, QA, and A1–A4 products.
- NASA, [Black Marble project](https://science.gsfc.nasa.gov/earth/projects/586/). Program overview and data links.
- NASA Earth Engine catalog, [VNP46A2](https://developers.google.com/earth-engine/datasets/catalog/NASA_VIIRS_002_VNP46A2). Convenient access description; authoritative product meaning remains NASA's guide.
- Earth Observation Group, [VIIRS Nighttime Light products](https://eogdata.mines.edu/products/vnl/). Monthly/annual composites, masks, 15-arc-second resolution, and version notes.
- Elvidge et al., [Annual Time Series of Global VIIRS Nighttime Lights Derived from Monthly Averages: 2012 to 2019](https://doi.org/10.3390/rs13050922). EOG annual composite method and grid.
- NASA, [Earth at Night maps](https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/). Display-oriented 500 m/3 km/0.1° products; useful for visual checks, not the scientific ingest.
- NASA, [VIIRS instrument/nighttime overview](https://www.nasa.gov/wp-content/uploads/2019/11/earth_at_night_508.pdf). DNB approximate 742 m footprint and 500–900 nm range.

## High-resolution and spectral nighttime imagery

- NASA JSC, [Gateway to Astronaut Photography of Earth](https://eol.jsc.nasa.gov/). Complete astronaut photography archive.
- NASA JSC, [Geolocating Astronaut Photography](https://esrs.jsc.nasa.gov/BeyondThePhotography/AutomatedGeolocalization/). Explains missing inherent ground geolocation and nighttime matching work.
- NASA NTRS, [Explore Astronaut Photography with the New GIS Data Portal](https://ntrs.nasa.gov/citations/20240004906). Notes georeferenced portal and nighttime images down to about 4 m/pixel.
- Sánchez de Miguel et al., [Calibration of DSLR-based images from the International Space Station](https://doi.org/10.3390/rs13163181). Required radiometric, spectral, optical, astrometric, and atmosphere calibration steps.
- International Research Center of Big Data for Sustainable Development Goals, [SDGSAT-1 mission](https://www.sdgsat.ac.cn/satellite/describe) and [data-use regulations](https://www.sdgsat.ac.cn/preview/20220920/557ffd2c1711428391034c08666d97eb.pdf). Instrument and restrictive research/non-commercial terms.
- JRC, [SDGSAT-1 experimental GHSL work](https://human-settlement.emergency.copernicus.eu/GHS_SDGSAT.php). Example research use of high-resolution glimmer imagery.
- Carr et al., [TEMPO at Night](https://doi.org/10.1029/2024EA004157). Experimental geostationary spectral observations of artificial light at night.

## Geometry and surface context

- OpenStreetMap, [planet PBF archive](https://planet.openstreetmap.org/pbf/) and [copyright/licence](https://www.openstreetmap.org/copyright). Official global snapshot and ODbL obligations.
- DLR, [World Settlement Footprint 2019](https://web.geoservice.dlr.de/web/datasets/wsf_2019). Global 10 m settlement mask, validation notes, STAC, DOI, CC BY 4.0.
- European Commission JRC, [GHS-BUILT-S R2023A](https://human-settlement.emergency.copernicus.eu/ghs_buS2023.php). Global multitemporal built-up surface.
- Microsoft, [Global ML Building Footprints](https://github.com/microsoft/GlobalMLBuildingFootprints). Worldwide machine-derived buildings under ODbL.
- Copernicus, [DEM documentation](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM.html) and [AWS open registry](https://registry.opendata.aws/copernicus-dem/). GLO-30/GLO-90 coverage, DSM semantics, formats, and terms.
- NASA MODIS, [BRDF/albedo products](https://modis.gsfc.nasa.gov/data/dataprod/mod43.php). Current MCD43 family; use Collection 6.1 rather than decommissioned 6.0.

## Spatial index

- H3, [cell statistics across resolutions](https://h3geo.org/docs/core-library/restable/). Counts, areas, variation, edges, and spherical model caveat.
- H3, [documentation](https://h3geo.org/docs/). Hierarchical global index concepts and APIs.
- `h3o`, [Rust API documentation](https://docs.rs/h3o/latest/h3o/). Candidate pure-Rust implementation; version must be frozen during implementation.

## Propagation physics and existing atlases

- Falchi et al., [The New World Atlas of Artificial Night Sky Brightness](https://doi.org/10.1126/sciadv.1600377) and [open supplement](https://doi.org/10.5880/GFZ.1.4.2016.001). VIIRS-derived source field, propagation model, ground calibration, 30-arc-second artificial zenith radiance.
- Cinzano and Falchi, [The propagation of light pollution in the atmosphere](https://doi.org/10.1093/mnras/sts078). Curved Earth, scattering, wavelength, atmosphere, terrain/source elevation, ground reflection, and spatially variable emission functions.
- Aubé, [Physical behaviour of anthropogenic light propagation into the nocturnal environment](https://pmc.ncbi.nlm.nih.gov/articles/PMC4375359/). Illumina model paths including scattering and ground reflection.
- Bará et al., [Towards a global map of the artificial all-sky brightness](https://arxiv.org/abs/2203.09322). Efficient all-sky source contribution representation.
- Falchi, [Computing light pollution indicators for environmental assessment](https://doi.org/10.1002/ntls.10019). Propagation inputs and environmental indicators.
- Kocifaj et al., [Measurements and Modelling of Artificial Sky Brightness](https://doi.org/10.3390/rs13183653). Combining satellite and ground measurements with Monte Carlo radiative transfer.

## Spectral and model limitations

- Hung et al., [Changes in night sky brightness after a countywide LED retrofit](https://arxiv.org/abs/2107.02026). Ground skyglow brightened while VIIRS upward radiance decreased; demonstrates spectral/angular ambiguity.
- Bará and Castro-Torres, [Diverging evolution of light pollution indicators](https://doi.org/10.1016/j.jqsrt.2025.109598). Spectral sensitivity can help explain different satellite and naked-eye trends.
- Kyba et al., [Citizen scientists report global rapid reductions in the visibility of stars](https://doi.org/10.1126/science.abq7781). Globe at Night trend and data availability.

## Atmosphere and validation

- Copernicus, [CAMS atmosphere service](https://www.copernicus.eu/en/copernicus-services/atmosphere). Global atmosphere composition, aerosols, analysis/forecast/reanalysis.
- Copernicus/ECMWF, [ERA5 complete](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-complete). Hourly global atmosphere at about 31 km and 137 levels.
- NASA GMAO, [MERRA-2 aerosol product documentation](https://gmao.gsfc.nasa.gov/reanalysis/MERRA-2/). Global aerosol reanalysis and diagnostics.
- National Park Service, [Measuring night sky brightness](https://www.nps.gov/subjects/nightskies/measuring.htm), [methods](https://www.nps.gov/subjects/nightskies/methods.htm), and [data sites](https://www.nps.gov/subjects/nightskies/datacollectionsites.htm). Calibrated V-band all-sky methods and site reports.
- STARS4ALL/GUAIX, [TESS photometers](https://guaix.fis.ucm.es/tess/). Continuous open network and device information.
- Globe at Night, [observations map/data](https://www.globeatnight.org/maps.php). Global citizen-science sky visibility observations.

## Temporal context

- NASA, [VIIRS C2 active-fire user guide](https://www.earthdata.nasa.gov/s3fs-public/2024-07/VIIRS_C2_AF-375m_User_Guide_1.0.pdf). Independent official statement of nominal Suomi-NPP 01:30/13:30 equator crossings.
- Román and Stokes, [Holidays in lights](https://doi.org/10.1002/2014EF000285). Seasonal/cultural variation detectable near satellite sampling time.
- Steinbach et al., [Reduced street lighting and road casualties/crime in England and Wales](https://pmc.ncbi.nlm.nih.gov/articles/PMC4680141/). Documents widespread part-night lighting, dimming, and switch-off practices in local authorities; useful evidence that schedules are real but local.

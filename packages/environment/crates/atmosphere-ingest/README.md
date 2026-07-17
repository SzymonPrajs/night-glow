# `atmosphere-ingest`

This first native adapter normalizes metadata-rich extracted variables from the
three planned atmosphere families: ERA5, CAMS, and MERRA-2. It converts only
explicitly declared units and preserves provider, collection, source-variable,
vertical-coordinate, evidence, wet/dry, missingness, and licence metadata.

The fixture is synthetic and CC0. It does not prove dataset access, collection
selection, real GRIB/netCDF decoding, provider formulas, aerosol closure, or
redistribution. Those remain in the bounded atmosphere feasibility gate.

# Spectral colour and observer transforms

Owns integration between spectral bases/passbands and explicitly named observer/sensor responses.

Inputs: absolute spectral radiance, source wavelength basis, target response functions, observation adaptation/exposure state. Outputs: band-integrated radiance, photometric quantities, camera/eye responses, or linear display primaries with documented transform.

Research must quantify errors from the runtime band basis, especially for narrow LED/sodium lines, stellar colours, ozone/oxygen structure, and mesopic vision. Photopic, scotopic, mesopic, melanopic, and camera transforms remain distinct. White balance, exposure, gamut mapping, and tone mapping operate after physical radiance assembly and must not feed back into transport.

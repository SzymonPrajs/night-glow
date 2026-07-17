# Spectral colour and observer transforms

Owns integration between spectral bases/passbands and explicitly named observer/sensor responses.

Inputs: absolute spectral radiance, source wavelength basis and declared physical observer/sensor response functions. Outputs: band-integrated radiance, photometric quantities, camera/eye response values, or a declared linear observer basis for Viewer composition.

Research must quantify errors from the runtime band basis, especially for narrow LED/sodium lines, stellar colours, ozone/oxygen structure, and mesopic vision. Photopic, scotopic, mesopic, melanopic, and camera transforms remain distinct. Viewer-owned white balance, exposure, gamut mapping, and tone mapping operate after physical radiance/observer-response assembly and must not feed back into Physics.

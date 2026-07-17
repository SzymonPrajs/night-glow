# Earthshine

Owns the path Sun → Earth atmosphere/surface/clouds → Moon → observer.

Inputs: solar illumination of the visible Earth from the Moon, Earth cloud/surface BRDF state, atmospheric reflection, lunar response, geometry and wavelength basis. Outputs: irradiance incident on the Moon and its contribution to returned lunar radiance.

Research must define disk integration of spatially varying Earth, clouds/ocean/land anisotropy, Earth phase as seen from the Moon, spectral albedo, and retained reflection orders. The first useful implementation may use a validated apparent Earth albedo; the reference design should permit mapped Earth state. Feedback orders must be enumerated to avoid accidental recursion.

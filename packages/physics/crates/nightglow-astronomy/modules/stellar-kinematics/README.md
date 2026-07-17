# Stellar kinematics

Owns propagation from catalogue reference epoch to observation epoch: position, parallax, proper motion, radial velocity/perspective acceleration where supported, aberration, and apparent-place transforms.

Inputs carry catalogue covariance/quality and missing radial-velocity semantics. Outputs include propagated direction/distance and uncertainty or a flag that a reduced model was used. Research must follow Gaia guidance, handle high-proper-motion tile migration, binaries/variables separately, and establish angular-error thresholds for each LOD and time span.

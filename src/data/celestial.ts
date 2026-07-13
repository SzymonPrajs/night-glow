export type StarRecord = {
  name: string
  ra: number
  dec: number
  mag: number
  color: number
  constellation: string
}

// Bright-star subset (J2000), sufficient for the recognizable naked-eye sky.
export const BRIGHT_STARS: StarRecord[] = [
  { name: 'Sirius', ra: 6.7525, dec: -16.7161, mag: -1.46, color: -0.01, constellation: 'Canis Major' },
  { name: 'Canopus', ra: 6.3992, dec: -52.6957, mag: -0.74, color: 0.15, constellation: 'Carina' },
  { name: 'Arcturus', ra: 14.261, dec: 19.1824, mag: -0.05, color: 1.23, constellation: 'Boötes' },
  { name: 'Vega', ra: 18.6156, dec: 38.7837, mag: 0.03, color: 0.0, constellation: 'Lyra' },
  { name: 'Capella', ra: 5.2782, dec: 45.998, mag: 0.08, color: 0.8, constellation: 'Auriga' },
  { name: 'Rigel', ra: 5.2423, dec: -8.2016, mag: 0.13, color: -0.03, constellation: 'Orion' },
  { name: 'Procyon', ra: 7.655, dec: 5.225, mag: 0.34, color: 0.42, constellation: 'Canis Minor' },
  { name: 'Achernar', ra: 1.6286, dec: -57.2368, mag: 0.46, color: -0.16, constellation: 'Eridanus' },
  { name: 'Betelgeuse', ra: 5.9195, dec: 7.4071, mag: 0.5, color: 1.85, constellation: 'Orion' },
  { name: 'Hadar', ra: 14.0637, dec: -60.373, mag: 0.61, color: -0.23, constellation: 'Centaurus' },
  { name: 'Altair', ra: 19.8464, dec: 8.8683, mag: 0.76, color: 0.22, constellation: 'Aquila' },
  { name: 'Acrux', ra: 12.4433, dec: -63.0991, mag: 0.77, color: -0.24, constellation: 'Crux' },
  { name: 'Aldebaran', ra: 4.5987, dec: 16.5093, mag: 0.85, color: 1.54, constellation: 'Taurus' },
  { name: 'Antares', ra: 16.4901, dec: -26.432, mag: 0.96, color: 1.83, constellation: 'Scorpius' },
  { name: 'Spica', ra: 13.4199, dec: -11.1613, mag: 0.98, color: -0.23, constellation: 'Virgo' },
  { name: 'Pollux', ra: 7.7553, dec: 28.0262, mag: 1.14, color: 1.0, constellation: 'Gemini' },
  { name: 'Fomalhaut', ra: 22.9608, dec: -29.6222, mag: 1.16, color: 0.09, constellation: 'Piscis Austrinus' },
  { name: 'Deneb', ra: 20.6905, dec: 45.2803, mag: 1.25, color: 0.09, constellation: 'Cygnus' },
  { name: 'Mimosa', ra: 12.7953, dec: -59.6888, mag: 1.25, color: -0.24, constellation: 'Crux' },
  { name: 'Regulus', ra: 10.1395, dec: 11.9672, mag: 1.35, color: -0.11, constellation: 'Leo' },
  { name: 'Adhara', ra: 6.9771, dec: -28.9721, mag: 1.5, color: -0.21, constellation: 'Canis Major' },
  { name: 'Castor', ra: 7.5767, dec: 31.8883, mag: 1.58, color: 0.04, constellation: 'Gemini' },
  { name: 'Gacrux', ra: 12.5194, dec: -57.1132, mag: 1.63, color: 1.6, constellation: 'Crux' },
  { name: 'Shaula', ra: 17.5601, dec: -37.1038, mag: 1.62, color: -0.23, constellation: 'Scorpius' },
  { name: 'Bellatrix', ra: 5.4189, dec: 6.3497, mag: 1.64, color: -0.22, constellation: 'Orion' },
  { name: 'Elnath', ra: 5.4382, dec: 28.6075, mag: 1.65, color: -0.13, constellation: 'Taurus' },
  { name: 'Miaplacidus', ra: 9.22, dec: -69.7172, mag: 1.67, color: 0.07, constellation: 'Carina' },
  { name: 'Alnilam', ra: 5.6036, dec: -1.2019, mag: 1.69, color: -0.18, constellation: 'Orion' },
  { name: 'Alnair', ra: 22.1372, dec: -46.9609, mag: 1.74, color: -0.07, constellation: 'Grus' },
  { name: 'Alioth', ra: 12.9005, dec: 55.9598, mag: 1.76, color: 0.02, constellation: 'Ursa Major' },
  { name: 'Alnitak', ra: 5.6793, dec: -1.9426, mag: 1.77, color: -0.2, constellation: 'Orion' },
  { name: 'Dubhe', ra: 11.0621, dec: 61.751, mag: 1.79, color: 1.07, constellation: 'Ursa Major' },
  { name: 'Mirfak', ra: 3.4054, dec: 49.8612, mag: 1.79, color: 0.48, constellation: 'Perseus' },
  { name: 'Wezen', ra: 7.1399, dec: -26.3932, mag: 1.83, color: 0.68, constellation: 'Canis Major' },
  { name: 'Sargas', ra: 17.6219, dec: -42.9978, mag: 1.86, color: 1.38, constellation: 'Scorpius' },
  { name: 'Kaus Australis', ra: 18.4029, dec: -34.3846, mag: 1.79, color: -0.03, constellation: 'Sagittarius' },
  { name: 'Avior', ra: 8.3752, dec: -59.5095, mag: 1.86, color: 1.2, constellation: 'Carina' },
  { name: 'Alkaid', ra: 13.7923, dec: 49.3133, mag: 1.86, color: -0.1, constellation: 'Ursa Major' },
  { name: 'Menkalinan', ra: 5.9921, dec: 44.9474, mag: 1.9, color: 0.08, constellation: 'Auriga' },
  { name: 'Atria', ra: 16.8111, dec: -69.0277, mag: 1.91, color: 1.44, constellation: 'Triangulum Australe' },
  { name: 'Alhena', ra: 6.6285, dec: 16.3993, mag: 1.93, color: 0.0, constellation: 'Gemini' },
  { name: 'Peacock', ra: 20.4275, dec: -56.7351, mag: 1.94, color: -0.2, constellation: 'Pavo' },
  { name: 'Polaris', ra: 2.5303, dec: 89.2641, mag: 1.98, color: 0.6, constellation: 'Ursa Minor' },
  { name: 'Mirzam', ra: 6.3783, dec: -17.9559, mag: 1.98, color: -0.24, constellation: 'Canis Major' },
  { name: 'Alphard', ra: 9.4598, dec: -8.6586, mag: 1.98, color: 1.45, constellation: 'Hydra' },
  { name: 'Hamal', ra: 2.1195, dec: 23.4624, mag: 2.0, color: 1.15, constellation: 'Aries' },
  { name: 'Diphda', ra: 0.7265, dec: -17.9866, mag: 2.02, color: 1.02, constellation: 'Cetus' },
  { name: 'Nunki', ra: 18.9211, dec: -26.2967, mag: 2.02, color: -0.13, constellation: 'Sagittarius' },
  { name: 'Saiph', ra: 5.7959, dec: -9.6696, mag: 2.07, color: -0.17, constellation: 'Orion' },
  { name: 'Kochab', ra: 14.8451, dec: 74.1555, mag: 2.08, color: 1.47, constellation: 'Ursa Minor' },
  { name: 'Algol', ra: 3.1361, dec: 40.9556, mag: 2.12, color: -0.05, constellation: 'Perseus' },
  { name: 'Denebola', ra: 11.8177, dec: 14.5721, mag: 2.14, color: 0.09, constellation: 'Leo' },
  { name: 'Mizar', ra: 13.3987, dec: 54.9254, mag: 2.23, color: 0.0, constellation: 'Ursa Major' },
  { name: 'Alphecca', ra: 15.5781, dec: 26.7147, mag: 2.22, color: 0.03, constellation: 'Corona Borealis' },
  { name: 'Rasalhague', ra: 17.5822, dec: 12.56, mag: 2.07, color: 0.15, constellation: 'Ophiuchus' },
  { name: 'Etamin', ra: 17.9434, dec: 51.4889, mag: 2.24, color: 1.52, constellation: 'Draco' },
  { name: 'Scheat', ra: 23.0629, dec: 28.0828, mag: 2.44, color: 1.65, constellation: 'Pegasus' },
  { name: 'Markab', ra: 23.0794, dec: 15.2053, mag: 2.49, color: -0.02, constellation: 'Pegasus' },
  { name: 'Alpheratz', ra: 0.1398, dec: 29.0904, mag: 2.06, color: -0.11, constellation: 'Andromeda' },
  { name: 'Caph', ra: 0.1529, dec: 59.1498, mag: 2.27, color: 0.34, constellation: 'Cassiopeia' },
  { name: 'Schedar', ra: 0.6751, dec: 56.5373, mag: 2.24, color: 1.17, constellation: 'Cassiopeia' },
  { name: 'Ruchbah', ra: 1.4303, dec: 60.2353, mag: 2.68, color: -0.15, constellation: 'Cassiopeia' },
  { name: 'Segin', ra: 1.9066, dec: 63.67, mag: 3.35, color: -0.08, constellation: 'Cassiopeia' },
]

export type DeepSkyRecord = {
  name: string
  catalog: string
  ra: number
  dec: number
  mag: number
  size: number
  kind: 'cluster' | 'galaxy' | 'nebula'
}

export const DEEP_SKY: DeepSkyRecord[] = [
  { name: 'Pleiades', catalog: 'M45', ra: 3.791, dec: 24.117, mag: 1.6, size: 110, kind: 'cluster' },
  { name: 'Hyades', catalog: 'Caldwell 41', ra: 4.45, dec: 15.87, mag: 0.5, size: 330, kind: 'cluster' },
  { name: 'Beehive Cluster', catalog: 'M44', ra: 8.67, dec: 19.67, mag: 3.1, size: 95, kind: 'cluster' },
  { name: 'Double Cluster', catalog: 'NGC 869/884', ra: 2.33, dec: 57.15, mag: 3.7, size: 60, kind: 'cluster' },
  { name: 'Omega Centauri', catalog: 'NGC 5139', ra: 13.447, dec: -47.479, mag: 3.9, size: 36, kind: 'cluster' },
  { name: '47 Tucanae', catalog: 'NGC 104', ra: 0.4, dec: -72.08, mag: 4.1, size: 31, kind: 'cluster' },
  { name: 'Hercules Cluster', catalog: 'M13', ra: 16.695, dec: 36.467, mag: 5.8, size: 20, kind: 'cluster' },
  { name: 'Wild Duck Cluster', catalog: 'M11', ra: 18.851, dec: -6.267, mag: 6.3, size: 14, kind: 'cluster' },
  { name: 'Andromeda Galaxy', catalog: 'M31', ra: 0.712, dec: 41.269, mag: 3.4, size: 180, kind: 'galaxy' },
  { name: 'Orion Nebula', catalog: 'M42', ra: 5.588, dec: -5.391, mag: 4.0, size: 85, kind: 'nebula' },
  { name: 'Lagoon Nebula', catalog: 'M8', ra: 18.063, dec: -24.386, mag: 6.0, size: 90, kind: 'nebula' },
]

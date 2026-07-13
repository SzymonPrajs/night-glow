/**
 * Rounded fallback geometry and demographic weights for the central-Poland demo region.
 * These are deliberately labelled proxies: measured nighttime radiance or a calibrated
 * municipal inventory should supersede them through the shared coverageId.
 */
export type RegionalSettlementFootprint = {
  id: string
  name: string
  country: string
  center: { lat: number; lon: number }
  semiMajorKm: number
  semiMinorKm: number
  rotationDeg: number
  populationProxy: number
  builtAreaProxyKm2: number
  lightingIntensity: number
}

export const REGIONAL_SETTLEMENT_FOOTPRINTS: readonly RegionalSettlementFootprint[] = [
  { id: 'pl-lodz', name: 'Łódź', country: 'PL', center: { lat: 51.7592, lon: 19.4560 }, semiMajorKm: 13, semiMinorKm: 9.5, rotationDeg: 18, populationProxy: 670000, builtAreaProxyKm2: 180, lightingIntensity: 1.05 },
  { id: 'pl-zgierz', name: 'Zgierz', country: 'PL', center: { lat: 51.8556, lon: 19.4062 }, semiMajorKm: 4.5, semiMinorKm: 3, rotationDeg: 20, populationProxy: 55000, builtAreaProxyKm2: 25, lightingIntensity: 0.78 },
  { id: 'pl-pabianice', name: 'Pabianice', country: 'PL', center: { lat: 51.6645, lon: 19.3547 }, semiMajorKm: 4.5, semiMinorKm: 3, rotationDeg: -10, populationProxy: 65000, builtAreaProxyKm2: 28, lightingIntensity: 0.82 },
  { id: 'pl-aleksandrow-lodzki', name: 'Aleksandrów Łódzki', country: 'PL', center: { lat: 51.8197, lon: 19.3038 }, semiMajorKm: 3.2, semiMinorKm: 2.2, rotationDeg: 40, populationProxy: 22000, builtAreaProxyKm2: 12, lightingIntensity: 0.72 },
  { id: 'pl-konstantynow-lodzki', name: 'Konstantynów Łódzki', country: 'PL', center: { lat: 51.7477, lon: 19.3256 }, semiMajorKm: 3.5, semiMinorKm: 2, rotationDeg: 25, populationProxy: 19000, builtAreaProxyKm2: 10, lightingIntensity: 0.72 },
  { id: 'pl-lask', name: 'Łask', country: 'PL', center: { lat: 51.5906, lon: 19.1328 }, semiMajorKm: 3, semiMinorKm: 2, rotationDeg: 10, populationProxy: 18000, builtAreaProxyKm2: 9, lightingIntensity: 0.66 },
  { id: 'pl-zdunska-wola', name: 'Zduńska Wola', country: 'PL', center: { lat: 51.5990, lon: 18.9393 }, semiMajorKm: 4, semiMinorKm: 2.8, rotationDeg: 5, populationProxy: 40000, builtAreaProxyKm2: 18, lightingIntensity: 0.76 },
  { id: 'pl-sieradz', name: 'Sieradz', country: 'PL', center: { lat: 51.5958, lon: 18.7302 }, semiMajorKm: 4.3, semiMinorKm: 3, rotationDeg: 10, populationProxy: 40000, builtAreaProxyKm2: 20, lightingIntensity: 0.76 },
  { id: 'pl-kalisz', name: 'Kalisz', country: 'PL', center: { lat: 51.7611, lon: 18.0910 }, semiMajorKm: 6, semiMinorKm: 4.5, rotationDeg: 10, populationProxy: 95000, builtAreaProxyKm2: 42, lightingIntensity: 0.87 },
  { id: 'pl-konin', name: 'Konin', country: 'PL', center: { lat: 52.2230, lon: 18.2511 }, semiMajorKm: 5.5, semiMinorKm: 3.6, rotationDeg: 30, populationProxy: 70000, builtAreaProxyKm2: 35, lightingIntensity: 0.87 },
  { id: 'pl-kutno', name: 'Kutno', country: 'PL', center: { lat: 52.2306, lon: 19.3641 }, semiMajorKm: 4.3, semiMinorKm: 3.2, rotationDeg: -5, populationProxy: 45000, builtAreaProxyKm2: 21, lightingIntensity: 0.80 },
  { id: 'pl-leczyca', name: 'Łęczyca', country: 'PL', center: { lat: 52.0597, lon: 19.1997 }, semiMajorKm: 2.5, semiMinorKm: 1.8, rotationDeg: 0, populationProxy: 14000, builtAreaProxyKm2: 7, lightingIntensity: 0.62 },
  { id: 'pl-belchatow', name: 'Bełchatów', country: 'PL', center: { lat: 51.3688, lon: 19.3567 }, semiMajorKm: 5.2, semiMinorKm: 3.5, rotationDeg: 5, populationProxy: 55000, builtAreaProxyKm2: 28, lightingIntensity: 0.95 },
  { id: 'pl-piotrkow-trybunalski', name: 'Piotrków Trybunalski', country: 'PL', center: { lat: 51.4052, lon: 19.7030 }, semiMajorKm: 5.5, semiMinorKm: 4, rotationDeg: 0, populationProxy: 70000, builtAreaProxyKm2: 35, lightingIntensity: 0.86 },
  { id: 'pl-tomaszow-mazowiecki', name: 'Tomaszów Mazowiecki', country: 'PL', center: { lat: 51.5313, lon: 20.0080 }, semiMajorKm: 5, semiMinorKm: 3.5, rotationDeg: 15, populationProxy: 60000, builtAreaProxyKm2: 30, lightingIntensity: 0.82 },
  { id: 'pl-skierniewice', name: 'Skierniewice', country: 'PL', center: { lat: 51.9547, lon: 20.1583 }, semiMajorKm: 4.5, semiMinorKm: 3.2, rotationDeg: 10, populationProxy: 48000, builtAreaProxyKm2: 22, lightingIntensity: 0.81 },
  { id: 'pl-lowicz', name: 'Łowicz', country: 'PL', center: { lat: 52.1071, lon: 19.9450 }, semiMajorKm: 3.6, semiMinorKm: 2.6, rotationDeg: 20, populationProxy: 27000, builtAreaProxyKm2: 14, lightingIntensity: 0.71 },
  { id: 'pl-warsaw', name: 'Warsaw', country: 'PL', center: { lat: 52.2297, lon: 21.0122 }, semiMajorKm: 20, semiMinorKm: 14, rotationDeg: -10, populationProxy: 1860000, builtAreaProxyKm2: 480, lightingIntensity: 1.25 },
  { id: 'pl-radom', name: 'Radom', country: 'PL', center: { lat: 51.4027, lon: 21.1471 }, semiMajorKm: 8, semiMinorKm: 6, rotationDeg: 5, populationProxy: 200000, builtAreaProxyKm2: 90, lightingIntensity: 0.96 },
  { id: 'pl-czestochowa', name: 'Częstochowa', country: 'PL', center: { lat: 50.8118, lon: 19.1203 }, semiMajorKm: 8, semiMinorKm: 5.5, rotationDeg: 5, populationProxy: 210000, builtAreaProxyKm2: 90, lightingIntensity: 0.96 },
  { id: 'pl-katowice-conurbation', name: 'Katowice conurbation', country: 'PL', center: { lat: 50.2709, lon: 19.0399 }, semiMajorKm: 28, semiMinorKm: 14, rotationDeg: 70, populationProxy: 2100000, builtAreaProxyKm2: 650, lightingIntensity: 1.30 },
  { id: 'pl-krakow', name: 'Kraków', country: 'PL', center: { lat: 50.0647, lon: 19.9450 }, semiMajorKm: 15, semiMinorKm: 10, rotationDeg: 20, populationProxy: 800000, builtAreaProxyKm2: 260, lightingIntensity: 1.10 },
  { id: 'pl-kielce', name: 'Kielce', country: 'PL', center: { lat: 50.8661, lon: 20.6286 }, semiMajorKm: 7, semiMinorKm: 5, rotationDeg: 15, populationProxy: 185000, builtAreaProxyKm2: 80, lightingIntensity: 0.91 },
  { id: 'pl-plock', name: 'Płock', country: 'PL', center: { lat: 52.5463, lon: 19.7065 }, semiMajorKm: 6, semiMinorKm: 4, rotationDeg: 20, populationProxy: 115000, builtAreaProxyKm2: 55, lightingIntensity: 0.98 },
  { id: 'pl-poznan', name: 'Poznań', country: 'PL', center: { lat: 52.4064, lon: 16.9252 }, semiMajorKm: 15, semiMinorKm: 10, rotationDeg: 10, populationProxy: 540000, builtAreaProxyKm2: 230, lightingIntensity: 1.05 },
  { id: 'pl-wroclaw', name: 'Wrocław', country: 'PL', center: { lat: 51.1079, lon: 17.0385 }, semiMajorKm: 15, semiMinorKm: 10, rotationDeg: 5, populationProxy: 670000, builtAreaProxyKm2: 250, lightingIntensity: 1.10 },
  { id: 'pl-torun', name: 'Toruń', country: 'PL', center: { lat: 53.0138, lon: 18.5984 }, semiMajorKm: 8, semiMinorKm: 5.5, rotationDeg: 20, populationProxy: 195000, builtAreaProxyKm2: 85, lightingIntensity: 0.92 },
  { id: 'pl-bydgoszcz', name: 'Bydgoszcz', country: 'PL', center: { lat: 53.1235, lon: 18.0084 }, semiMajorKm: 11, semiMinorKm: 7, rotationDeg: 15, populationProxy: 340000, builtAreaProxyKm2: 140, lightingIntensity: 1.00 },
  { id: 'pl-lublin', name: 'Lublin', country: 'PL', center: { lat: 51.2465, lon: 22.5684 }, semiMajorKm: 10, semiMinorKm: 7, rotationDeg: 5, populationProxy: 330000, builtAreaProxyKm2: 130, lightingIntensity: 0.97 },
  { id: 'pl-gdansk', name: 'Gdańsk', country: 'PL', center: { lat: 54.3520, lon: 18.6466 }, semiMajorKm: 12, semiMinorKm: 8, rotationDeg: 10, populationProxy: 470000, builtAreaProxyKm2: 220, lightingIntensity: 1.04 },
  { id: 'pl-szczecin', name: 'Szczecin', country: 'PL', center: { lat: 53.4285, lon: 14.5528 }, semiMajorKm: 12, semiMinorKm: 8, rotationDeg: 15, populationProxy: 400000, builtAreaProxyKm2: 180, lightingIntensity: 0.98 },
  { id: 'de-berlin', name: 'Berlin', country: 'DE', center: { lat: 52.5200, lon: 13.4050 }, semiMajorKm: 22, semiMinorKm: 16, rotationDeg: 5, populationProxy: 3700000, builtAreaProxyKm2: 700, lightingIntensity: 1.30 },
  { id: 'cz-prague', name: 'Prague', country: 'CZ', center: { lat: 50.0755, lon: 14.4378 }, semiMajorKm: 18, semiMinorKm: 13, rotationDeg: 10, populationProxy: 1300000, builtAreaProxyKm2: 450, lightingIntensity: 1.20 },
  { id: 'at-vienna', name: 'Vienna', country: 'AT', center: { lat: 48.2082, lon: 16.3738 }, semiMajorKm: 18, semiMinorKm: 13, rotationDeg: 5, populationProxy: 2000000, builtAreaProxyKm2: 500, lightingIntensity: 1.22 },
  { id: 'lt-vilnius', name: 'Vilnius', country: 'LT', center: { lat: 54.6872, lon: 25.2797 }, semiMajorKm: 12, semiMinorKm: 9, rotationDeg: 20, populationProxy: 590000, builtAreaProxyKm2: 220, lightingIntensity: 1.02 },
]

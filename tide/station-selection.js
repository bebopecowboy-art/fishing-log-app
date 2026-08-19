export const TIDE_STATION_STORAGE_KEY = "otomoFishing.tideStation.v1";

export function readSelectedStationId(storage = localStorage) { return storage.getItem(TIDE_STATION_STORAGE_KEY); }
export function saveSelectedStationId(stationId, storage = localStorage) { storage.setItem(TIDE_STATION_STORAGE_KEY, stationId); }
export function clearSelectedStationId(storage = localStorage) { storage.removeItem(TIDE_STATION_STORAGE_KEY); }

export function filterStations(stations, { region = "", query = "" } = {}) {
  const needle = query.trim().toLocaleLowerCase("ja");
  return stations.filter((station) => (!region || station.region === region) && (!needle || `${station.displayName} ${station.searchText} ${station.region}`.toLocaleLowerCase("ja").includes(needle)));
}

export function distanceKm(latitude1, longitude1, latitude2, longitude2) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(latitude2 - latitude1);
  const dLon = radians(longitude2 - longitude1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2)) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nearestStations(stations, latitude, longitude, limit = 3) {
  return stations.filter((station) => Number.isFinite(station.latitude) && Number.isFinite(station.longitude))
    .map((station) => ({ ...station, distanceKm: distanceKm(latitude, longitude, station.latitude, station.longitude) }))
    .sort((a, b) => a.distanceKm - b.distanceKm).slice(0, limit);
}

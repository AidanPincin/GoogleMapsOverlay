const locationState = {
  watchId: null,
  lastPosition: null,
  mapReady: false,
};

let geocoder = null;
let autocomplete = null;
let townshipOverlay = null;

const TOWNHIP_SERVICE_URL =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/export';

function mercatorXfromLongitude(lon) {
  return (lon * 20037508.34) / 180;
}

function mercatorYfromLatitude(lat) {
  const rad = (lat * Math.PI) / 180;
  return 20037508.34 * Math.log(Math.tan(Math.PI / 4 + rad / 2)) / Math.PI;
}

function tileBounds(x, y, zoom) {
  const n = Math.pow(2, zoom);
  const lonMin = (x / n) * 360 - 180;
  const lonMax = ((x + 1) / n) * 360 - 180;
  const latMin = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
  const latMax = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;

  return {
    xmin: mercatorXfromLongitude(lonMin),
    ymin: mercatorYfromLatitude(latMin),
    xmax: mercatorXfromLongitude(lonMax),
    ymax: mercatorYfromLatitude(latMax),
  };
}

function createTownshipOverlay() {
  return new google.maps.ImageMapType({
    getTileUrl(coord, zoom) {
      const bounds = tileBounds(coord.x, coord.y, zoom);
      return `${TOWNHIP_SERVICE_URL}` +
        `?bbox=${bounds.xmin},${bounds.ymin},${bounds.xmax},${bounds.ymax}` +
        `&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&layers=show:1&f=image`;
    },
    tileSize: new google.maps.Size(256, 256),
    opacity: 0.8,
    name: 'Township Lines',
    alt: 'Township property line overlay',
  });
}

function toggleTownshipOverlay(statusElement) {
  if (!window.map) {
    statusElement.textContent = 'Map is not ready yet.';
    return;
  }

  if (!townshipOverlay) {
    townshipOverlay = createTownshipOverlay();
  }

  const overlayArray = window.map.overlayMapTypes.getArray();
  const overlayIndex = overlayArray.indexOf(townshipOverlay);
  const overlayButton = document.getElementById('overlayButton');

  if (overlayIndex === -1) {
    window.map.overlayMapTypes.push(townshipOverlay);
    statusElement.textContent = 'Township property lines overlay is now visible.';
    if (overlayButton) {
      overlayButton.textContent = 'Hide township property lines';
    }
  } else {
    window.map.overlayMapTypes.removeAt(overlayIndex);
    statusElement.textContent = 'Township property lines overlay has been hidden.';
    if (overlayButton) {
      overlayButton.textContent = 'Show township property lines';
    }
  }
}

function initAutocomplete() {
  const addressInput = document.getElementById("addressInput");
  const status = document.getElementById("status");

  if (!addressInput || !window.map || !google?.maps?.places) {
    return;
  }

  autocomplete = new google.maps.places.Autocomplete(addressInput, {
    fields: ["geometry", "formatted_address"],
  });

  const clearAddressButton = document.getElementById("clearAddressButton");

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (!place.geometry || !place.geometry.location) {
      if (status) {
        status.textContent = "Address not found; please select a suggested place.";
      }
      return;
    }

    window.map.panTo(place.geometry.location);
    if (status) {
      status.textContent = `Showing: ${place.formatted_address || addressInput.value}`;
    }
    if (clearAddressButton) {
      clearAddressButton.style.display = "inline-flex";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const trackButton = document.getElementById("trackButton");
  const centerButton = document.getElementById("centerButton");
  const overlayButton = document.getElementById("overlayButton");
  const addressInput = document.getElementById("addressInput");
  const clearAddressButton = document.getElementById("clearAddressButton");
  const status = document.getElementById("status");

  if (!trackButton || !centerButton || !overlayButton || !addressInput || !clearAddressButton || !status) {
    console.error("Missing UI elements for location tracking, township overlay, or address search.");
    return;
  }

  overlayButton.addEventListener('click', () => {
    toggleTownshipOverlay(status);
  });

  trackButton.addEventListener("click", () => {
    if (locationState.watchId !== null) {
      navigator.geolocation.clearWatch(locationState.watchId);
      locationState.watchId = null;
      trackButton.textContent = "Start tracking location";
      status.textContent = "Location tracking stopped.";
      return;
    }

    if (!navigator.geolocation) {
      status.textContent = "Geolocation is not supported by this browser.";
      return;
    }

    status.textContent = "Requesting permission to track location...";
    centerButton.disabled = true;

    locationState.watchId = navigator.geolocation.watchPosition(
      (position) => handlePosition(position, status),
      (error) => handleGeolocationError(error, status),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );

    trackButton.textContent = "Stop tracking location";
  });

  centerButton.addEventListener("click", () => {
    if (window.map && locationState.lastPosition) {
      window.map.panTo(locationState.lastPosition);
    }
  });

  clearAddressButton.addEventListener("click", () => {
    addressInput.value = "";
    clearAddressButton.style.display = "none";
    status.textContent = "Address cleared.";
    addressInput.focus();
  });

  addressInput.addEventListener("input", () => {
    clearAddressButton.style.display = addressInput.value.trim() ? "inline-flex" : "none";
  });

  addressInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const query = addressInput.value.trim();
      if (query) {
        geocodeAddress(query, status);
      }
    }
  });
});

function handlePosition(position, statusElement) {
  const { latitude, longitude, accuracy } = position.coords;
  const timeString = new Date(position.timestamp).toLocaleTimeString();

  statusElement.textContent = `Location updated at ${timeString}: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (accuracy ~${Math.round(accuracy)}m)`;

  if (window.map && window.locationMarker) {
    const actualPosition = { lat: latitude, lng: longitude };
    locationState.lastPosition = actualPosition;

    window.locationMarker.setPosition(actualPosition);
    window.locationMarker.setTitle(`Current position (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
    const centerButton = document.getElementById("centerButton");
    if (centerButton) {
      centerButton.disabled = false;
    }

    if (!window.accuracyCircle) {
      window.accuracyCircle = new google.maps.Circle({
        strokeColor: '#4285f4',
        strokeOpacity: 0.7,
        strokeWeight: 2,
        fillColor: '#4285f4',
        fillOpacity: 0.12,
        map: window.map,
        center: actualPosition,
        radius: Math.max(accuracy, 10),
      });
    } else {
      window.accuracyCircle.setCenter(actualPosition);
      window.accuracyCircle.setRadius(Math.max(accuracy, 10));
    }
  } else {
    console.warn("Map is not ready yet; location update will be applied once available.");
  }
}

function geocodeAddress(query, statusElement) {
  if (!geocoder || !window.map) {
    statusElement.textContent = "Geocoder is not ready yet.";
    return;
  }

  geocoder.geocode({ address: query }, (results, status) => {
    if (status !== "OK" || !results || !results.length) {
      statusElement.textContent = `Address not found: ${status}`;
      return;
    }

    const result = results[0];
    window.map.panTo(result.geometry.location);
    statusElement.textContent = `Showing: ${result.formatted_address}`;
  });
}

function handleGeolocationError(error, statusElement) {
  let message = "Unable to track location.";

  switch (error.code) {
    case error.PERMISSION_DENIED:
      message = "Location permission was denied.";
      break;
    case error.POSITION_UNAVAILABLE:
      message = "Location information is unavailable.";
      break;
    case error.TIMEOUT:
      message = "Location request timed out.";
      break;
    default:
      message = `Geolocation error: ${error.message}`;
      break;
  }

  statusElement.textContent = message;
  console.error(message, error);
}

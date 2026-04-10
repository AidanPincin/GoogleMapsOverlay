const locationState = {
  watchId: null,
  mapReady: false,
};

document.addEventListener("DOMContentLoaded", () => {
  const trackButton = document.getElementById("trackButton");
  const status = document.getElementById("status");

  if (!trackButton || !status) {
    console.error("Missing track button or status element.");
    return;
  }

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
});

function handlePosition(position, statusElement) {
  const { latitude, longitude, accuracy } = position.coords;
  const timeString = new Date(position.timestamp).toLocaleTimeString();

  statusElement.textContent = `Location updated at ${timeString}: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (accuracy ~${Math.round(accuracy)}m)`;

  if (window.map && window.locationMarker) {
    const newPosition = { lat: latitude, lng: longitude };
    window.locationMarker.setPosition(newPosition);
    window.locationMarker.setTitle(`Current position (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
    window.map.panTo(newPosition);
    window.map.setZoom(15);
  } else {
    console.warn("Map is not ready yet; location update will be applied once available.");
  }
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

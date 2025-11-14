// js/geocoding.js
// Handles address input, live suggestions, and geocoding via OpenStreetMap (Nominatim)

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

/**
 * Fetch suggestions while typing
 */
async function fetchAddressSuggestions(query) {
    if (!query || query.length < 3) return [];
    const url = `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`;
    const response = await fetch(url);
    const data = await response.json();
    return data.map(d => ({
        display_name: d.display_name,
        lat: parseFloat(d.lat),
        lon: parseFloat(d.lon)
    }));
}

/**
 * Convert full address string to coordinates
 */
async function geocodeAddress(address) {
    const url = `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.length === 0) throw new Error("Address not found. Try a more specific query.");
    const { lat, lon, display_name } = data[0];
    return { lat: parseFloat(lat), lon: parseFloat(lon), name: display_name };
}

/**
 * Attach suggestion dropdown logic to an input field
 */
function attachAddressAutocomplete(inputId) {
    const input = document.getElementById(inputId);
    const suggestionBox = document.createElement("div");
    suggestionBox.className = "list-group position-absolute w-100";
    suggestionBox.style.zIndex = "1000";
    input.parentNode.appendChild(suggestionBox);

    let timeout = null;

    input.addEventListener("input", () => {
        clearTimeout(timeout);
        const query = input.value.trim();
        if (query.length < 3) {
            suggestionBox.innerHTML = "";
            return;
        }
        timeout = setTimeout(async () => {
            const suggestions = await fetchAddressSuggestions(query);
            suggestionBox.innerHTML = "";
            suggestions.forEach(item => {
                const option = document.createElement("button");
                option.type = "button";
                option.className = "list-group-item list-group-item-action";
                option.textContent = item.display_name;
                option.addEventListener("click", () => {
                    input.value = item.display_name;
                    input.dataset.lat = item.lat;
                    input.dataset.lon = item.lon;
                    suggestionBox.innerHTML = "";
                });
                suggestionBox.appendChild(option);
            });
        }, 300);
    });

    // Hide suggestions when clicking outside
    document.addEventListener("click", (e) => {
        if (!suggestionBox.contains(e.target) && e.target !== input) {
            suggestionBox.innerHTML = "";
        }
    });
}

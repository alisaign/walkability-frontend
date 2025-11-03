function getCategoryIconClass(category) {
    const icons = {
        metro: 'fa-subway',
        bus: 'fa-bus',
        grocery: 'fa-shopping-cart',
        restaurants: 'fa-utensils',
        parks: 'fa-tree',
        schools: 'fa-graduation-cap',
        healthcare: 'fa-hospital',
    };
    return icons[category] || 'fa-map-marker-alt';
}

function initWalkabilityMap(DATA) {
    const center = [DATA.center.lat, DATA.center.lon];
    const map = L.map('map').setView(center, 15); // zoom like fallback

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    L.marker(center).addTo(map).bindPopup('Your Location');

    if (DATA.buffers_m && DATA.breakdown) {
        DATA.breakdown.forEach((item, i) => {
            if (item.weight > 0 && item.nearby_count > 0) {
                L.circle(center, {
                    radius: DATA.buffers_m[i],
                    color: '#ea580c',
                    fillColor: '#f97316',
                    weight: 1,
                    opacity: 0.3,
                    fillOpacity: 0.1
                }).addTo(map).bindPopup(`${item.name} buffer (${DATA.buffers_m[i]} m)`);

                const iconClass = getCategoryIconClass(item.name);
                const nearby = DATA.nearby.filter(poi => poi.category === item.name);
                nearby.forEach(poi => {
                    if (poi.geometry && poi.geometry.coordinates) {
                        const [lon, lat] = poi.geometry.coordinates;
                        const customIcon = L.divIcon({
                            html: `<i class="fas ${iconClass}" style="color:#f97316;font-size:18px;"></i>`,
                            className: 'custom-marker-icon',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        });
                        L.marker([lat, lon], { icon: customIcon })
                            .addTo(map)
                            .bindPopup(`<strong>${poi.name || item.name}</strong><br><small>${item.name}</small>`);
                    }
                });
            }
        });
    }
}

function initNeighborhoodGradientMap(DATA) {
    console.log("Gradient map JS loaded");

    if (!DATA.gradient_layer || !DATA.gradient_layer.features) return;

    const geojson = DATA.gradient_layer;
    const center = [DATA.center.lat, DATA.center.lon];
    const map2 = L.map('gradientMap').setView(center, 14);

    // --- Base map ---
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map2);

    // --- Stronger color contrast 
    function getColor(score) {
        let r, g, b = 0;
        if (score < 0.5) {
            // red → yellow (increase green)
            r = 255;
            g = Math.round(510 * score); // 0→255 as score goes 0→0.5
        } else {
            // yellow → green (decrease red)
            g = 255;
            r = Math.round(510 * (1 - score)); // 255→0 as score goes 0.5→1
        }
        return `rgba(${r}, ${g}, ${b}, 0.6)`; // alpha keeps blending smooth
    }

    // --- Style + interaction (hover to show score) ---
    function styleFeature(feature) {
        const s = feature.properties?.score ?? 0;
        return {
            fillColor: getColor(s),
            color: 'transparent',
            weight: 0,
            opacity: 0,
            fillOpacity: 0.65
        };
    }

    function onEachFeature(feature, layer) {
        const s = (feature.properties?.score ?? 0).toFixed(3);
        // Tooltip on hover
        layer.bindTooltip(`Score: ${s}`, {
            permanent: false,
            direction: 'top',
            offset: [0, -2],
            className: 'score-tooltip'
        });
        // Optional: console log on click
        layer.on('click', () => console.log("Clicked score:", s));
    }

    // --- Add polygons ---
    L.geoJSON(geojson, {
        style: styleFeature,
        onEachFeature: onEachFeature
    }).addTo(map2);
}

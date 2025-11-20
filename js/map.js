function getCategoryIconClass(category) {
    const icons = {
        metro: 'fa-subway',
        bus: 'fa-bus',
        bixi: 'fa-bicycle',
        park: 'fa-tree',
        grocery: 'fa-shopping-cart',
        restaurant: 'fa-utensils'
    };
    return icons[category] || 'fa-map-marker-alt';
}


function initWalkabilityMap(DATA) {
    const center = [DATA.center.lat, DATA.center.lon];
    const map = L.map('map', {
        fullscreenControl: true,
        fullscreenControlOptions: {
            position: 'topright'
        }
    }).setView(center, 16);

    //map.addControl(new L.Control.FullScreen());


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

                // // after you draw the buffer circle:

                // const labelIcon = L.divIcon({
                //     html: `<div style="
                //         background: white;
                //         padding: 2px 6px;
                //         border: 1px solid #f97316;
                //         border-radius: 4px;
                //         color: #ea580c;
                //         font-size: 12px;
                //         font-weight: 600;
                //         white-space: nowrap;
                //     ">${item.name}</div>`,
                //     className: '',
                //     iconSize: 'auto'
                // });

                // // position label slightly above the center
                // const labelLat = center[0] + 0.0008;
                // const labelLon = center[1];

                // L.marker([labelLat, labelLon], { icon: labelIcon, interactive: false }).addTo(map);


                const iconClass = getCategoryIconClass(item.name);
                const nearby = DATA.nearby.filter(poi => poi.category === item.name);
                nearby.forEach(poi => {
                    if (poi.geometry && poi.geometry.coordinates) {
                        let lat, lon;

                        // Handle Point geometry
                        if (poi.geometry.type === "Point") {
                            [lon, lat] = poi.geometry.coordinates;
                        }

                        // Handle Polygon geometry (use centroid of outer ring)
                        else if (poi.geometry.type === "Polygon") {
                            const ring = poi.geometry.coordinates[0]; // outer ring
                            let x = 0, y = 0;
                            ring.forEach(coord => {
                                x += coord[0];
                                y += coord[1];
                            });
                            x /= ring.length;
                            y /= ring.length;
                            lon = x;
                            lat = y;
                        }

                        // (Optional skip) If we ever find something else
                        else {
                            return; // do not try to render unknown geometry types
                        }

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
    setTimeout(() => {
        map.invalidateSize();
    }, 500);

    // // === BUFFER SCALE CONTROL ===
    // if (DATA.breakdown && DATA.buffers_m) {

    //     const categories = DATA.breakdown.map(b => b.name);
    //     const thresholds = DATA.buffers_m;

    //     const BufferScale = L.Control.extend({
    //         onAdd: function () {
    //             const div = L.DomUtil.create("div", "leaflet-buffer-scale");

    //             let html = "";
    //             categories.forEach((cat, i) => {
    //                 html += `
    //                 <div class="scale-tick">
    //                     <span class="scale-label">${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
    //                     <span class="scale-dist">${thresholds[i]} m</span>
    //                 </div>
    //             `;
    //             });

    //             div.innerHTML = html;
    //             return div;
    //         }
    //     });

    //     map.addControl(new BufferScale({ position: "topright" }));
    // }
    // // === END BUFFER SCALE CONTROL ===

}

function initNeighborhoodGradientMap(DATA) {
    console.log("Gradient map JS loaded");

    if (!DATA.gradient_layer || !DATA.gradient_layer.features) return;

    const geojson = DATA.gradient_layer;
    const center = [DATA.center.lat, DATA.center.lon];
    const map2 = L.map('gradientMap', { fullscreenControl: true }).setView(center, 14);

    // --- Base map ---
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; CartoDB'
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

    // === GRADIENT LEGEND WITH VALUE MARKER ===
    const legend = L.control({ position: "bottomright" });

    legend.onAdd = function () {
        const div = L.DomUtil.create("div", "gradient-legend");

        div.innerHTML = `
        <div class="legend-title">Walkability Score</div>
        <div class="legend-bar-container">
            <div class="legend-bar"></div>
            <div id="legend-marker"></div>
        </div>
        <div class="legend-scale">
            <span>0</span>
            <span>50</span>
            <span>100</span>
        </div>
    `;
        return div;
    };

    legend.addTo(map2);

    // Move the marker to the correct score
    const userScore = DATA.index ?? 0;
    const marker = document.getElementById("legend-marker");
    marker.style.left = (userScore) + "%";

}

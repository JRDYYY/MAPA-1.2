/* =========================================================
   BYDLENÍ — MAPA ČR
   Vanilla JavaScript
   ========================================================= */


/* =========================================================
   KONFIGURACE
========================================================= */

const RUIAN =
    "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer";

const OSM =
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const OVERPASS =
    "https://overpass-api.de/api/interpreter";

const NOMINATIM =
    "https://nominatim.openstreetmap.org/search";


/* =========================================================
   STAV
========================================================= */

let map;

let zoneLayer = null;
let schoolLayer = null;

let activeLayer = "price";

let selectedFeature = null;

let requestCounter = 0;

let schoolsEnabled = false;

let currentZoomLevel = 7.5;


/* =========================================================
   ADMINISTRATIVNÍ VRSTVY RÚIAN
========================================================= */

const RUIAN_LEVELS = {

    region: {
        id: 17,
        name: "Kraj"
    },

    district: {
        id: 15,
        name: "Okres"
    },

    municipality: {
        id: 12,
        name: "Obec"
    },

    cadastral: {
        id: 7,
        name: "Katastrální území"
    }

};


/* =========================================================
   ZOOM HIERARCHIE
========================================================= */

function getMapLevel(zoom) {

    if (zoom <= 7.5) {
        return RUIAN_LEVELS.region;
    }

    if (zoom <= 10) {
        return RUIAN_LEVELS.district;
    }

    if (zoom <= 12.5) {
        return RUIAN_LEVELS.municipality;
    }

    return RUIAN_LEVELS.cadastral;
}


/* =========================================================
   KRAJSKÁ MĚSTA
========================================================= */

const CAPITALS = [

    {
        name: "Praha",
        region: "Hlavní město Praha",
        lat: 50.0755,
        lng: 14.4378
    },

    {
        name: "České Budějovice",
        region: "Jihočeský kraj",
        lat: 48.9745,
        lng: 14.4743
    },

    {
        name: "Brno",
        region: "Jihomoravský kraj",
        lat: 49.1951,
        lng: 16.6068
    },

    {
        name: "Karlovy Vary",
        region: "Karlovarský kraj",
        lat: 50.2319,
        lng: 12.8714
    },

    {
        name: "Hradec Králové",
        region: "Královéhradecký kraj",
        lat: 50.2092,
        lng: 15.8328
    },

    {
        name: "Liberec",
        region: "Liberecký kraj",
        lat: 50.7671,
        lng: 15.0562
    },

    {
        name: "Ostrava",
        region: "Moravskoslezský kraj",
        lat: 49.8209,
        lng: 18.2625
    },

    {
        name: "Olomouc",
        region: "Olomoucký kraj",
        lat: 49.5938,
        lng: 17.2509
    },

    {
        name: "Pardubice",
        region: "Pardubický kraj",
        lat: 50.0343,
        lng: 15.7812
    },

    {
        name: "Plzeň",
        region: "Plzeňský kraj",
        lat: 49.7384,
        lng: 13.3736
    },

    {
        name: "Ústí nad Labem",
        region: "Ústecký kraj",
        lat: 50.6607,
        lng: 14.0323
    },

    {
        name: "Jihlava",
        region: "Kraj Vysočina",
        lat: 49.3961,
        lng: 15.5912
    },

    {
        name: "Zlín",
        region: "Zlínský kraj",
        lat: 49.2265,
        lng: 17.668
    }

];


/* =========================================================
   AKTUÁLNÍ NABÍDKOVÉ CENY — 09/2026
========================================================= */

const CAPITAL_PRICES = {

    "Praha": 154338,
    "České Budějovice": 87304,
    "Brno": 123456,
    "Karlovy Vary": 69660,
    "Hradec Králové": 96898,
    "Liberec": 83642,
    "Ostrava": 71032,
    "Olomouc": 86539,
    "Pardubice": 84773,
    "Plzeň": 94816,
    "Ústí nad Labem": 51580,
    "Jihlava": 71148,
    "Zlín": 87253

};


/* =========================================================
   AKTUÁLNÍ NÁJMY — 09/2026
========================================================= */

const CAPITAL_RENTS = {

    "Praha": 465,
    "České Budějovice": 276,
    "Brno": 463,
    "Karlovy Vary": 236,
    "Hradec Králové": 294,
    "Liberec": 290,
    "Ostrava": 250,
    "Olomouc": 280,
    "Pardubice": 288,
    "Plzeň": 292,
    "Ústí nad Labem": 244,
    "Jihlava": 248,
    "Zlín": 284

};


/* =========================================================
   POMOCNÉ FUNKCE
========================================================= */

function showLoading(text) {

    const box =
        document.getElementById("loading");

    box.textContent = text;

    box.classList.remove("hidden");
}


function hideLoading() {

    document
        .getElementById("loading")
        .classList.add("hidden");

}


function showError(message) {

    const box =
        document.getElementById("errorBox");

    box.textContent = message;

    box.classList.remove("hidden");

}


function hideError() {

    document
        .getElementById("errorBox")
        .classList.add("hidden");

}


function formatNumber(value) {

    return Number(value)
        .toLocaleString("cs-CZ");

}


/* =========================================================
   DETERMINISTICKÉ DEMO HODNOTY
========================================================= */

function seededValue(name, min, max) {

    let hash = 0;

    const text = String(name || "");

    for (let i = 0; i < text.length; i++) {

        hash =
            ((hash << 5) - hash) +
            text.charCodeAt(i);

        hash |= 0;
    }

    const normalized =
        Math.abs(hash) % 1000 / 1000;

    return min +
        normalized *
        (max - min);
}


/* =========================================================
   ZÍSKÁNÍ NÁZVU FEATURE
========================================================= */

function featureName(feature) {

    const p =
        feature &&
        feature.properties
            ? feature.properties
            : {};

    return (
        p.nazev ||
        p.Nazev ||
        p.name ||
        p.NAME ||
        "Neznámá lokalita"
    );

}


/* =========================================================
   METRIKY
========================================================= */

function getMetric(feature, type) {

    const name =
        featureName(feature);


    /* -------------------------
       CENA
    ------------------------- */

    if (type === "price") {

        if (
            Object.prototype.hasOwnProperty
                .call(CAPITAL_PRICES, name)
        ) {

            return {
                value: CAPITAL_PRICES[name],
                real: true,
                label:
                    "RealityMIX 09/2026 — nabídková cena"
            };

        }

        return {
            value:
                seededValue(
                    name,
                    50000,
                    120000
                ),
            real: false,
            label:
                "DEMO — celostátní data nejsou připojena"
        };

    }


    /* -------------------------
       NÁJEM
    ------------------------- */

    if (type === "rent") {

        if (
            Object.prototype.hasOwnProperty
                .call(CAPITAL_RENTS, name)
        ) {

            return {
                value: CAPITAL_RENTS[name],
                real: true,
                label:
                    "RealityMIX 09/2026 — Kč/m²/měsíc"
            };

        }

        return {
            value:
                seededValue(
                    name,
                    200,
                    420
                ),
            real: false,
            label:
                "DEMO — celostátní data nejsou připojena"
        };

    }


    /* -------------------------
       ZELEŇ
    ------------------------- */

    if (type === "green") {

        return {
            value:
                seededValue(
                    name,
                    15,
                    75
                ),
            real: false,
            label:
                "DEMO index zeleně"
        };

    }


    /* -------------------------
       HLUK
    ------------------------- */

    if (type === "noise") {

        return {
            value:
                seededValue(
                    name,
                    15,
                    90
                ),
            real: false,
            label:
                "DEMO index hluku"
        };

    }


    /* -------------------------
       BEZPEČNOST
    ------------------------- */

    if (type === "safety") {

        return {
            value:
                seededValue(
                    name,
                    30,
                    95
                ),
            real: false,
            label:
                "DEMO index bezpečnosti"
        };

    }


    return {
        value: 0,
        real: false,
        label: "Není k dispozici"
    };

}


/* =========================================================
   BARVY
========================================================= */

function interpolateColor(c1, c2, t) {

    const r =
        Math.round(
            c1[0] +
            (c2[0] - c1[0]) * t
        );

    const g =
        Math.round(
            c1[1] +
            (c2[1] - c1[1]) * t
        );

    const b =
        Math.round(
            c1[2] +
            (c2[2] - c1[2]) * t
        );

    return `rgb(${r},${g},${b})`;
}


function scaleColor(value, min, max, colors) {

    let t =
        (value - min) /
        (max - min);

    t =
        Math.max(
            0,
            Math.min(1, t)
        );

    const scaled =
        t * (colors.length - 1);

    const index =
        Math.floor(scaled);

    if (
        index >=
        colors.length - 1
    ) {

        return `rgb(${colors[colors.length - 1].join(",")})`;

    }

    const localT =
        scaled - index;

    return interpolateColor(
        colors[index],
        colors[index + 1],
        localT
    );

}


/* =========================================================
   BARVA POLYGONU
========================================================= */

function getPolygonColor(feature) {

    const metric =
        getMetric(
            feature,
            activeLayer
        );


    if (activeLayer === "price") {

        return scaleColor(
            metric.value,
            50000,
            160000,
            [
                [35,165,90],
                [139,207,75],
                [244,216,74],
                [242,138,53],
                [210,52,52]
            ]
        );

    }


    if (activeLayer === "rent") {

        return scaleColor(
            metric.value,
            200,
            480,
            [
                [66,168,107],
                [229,212,92],
                [225,120,57],
                [198,59,50]
            ]
        );

    }


    if (activeLayer === "green") {

        return scaleColor(
            metric.value,
            0,
            100,
            [
                [237,248,237],
                [185,223,184],
                [76,154,82],
                [20,83,45]
            ]
        );

    }


    if (activeLayer === "noise") {

        return scaleColor(
            metric.value,
            0,
            100,
            [
                [40,164,90],
                [232,211,66],
                [233,121,50],
                [201,50,50]
            ]
        );

    }


    if (activeLayer === "safety") {

        return scaleColor(
            metric.value,
            0,
            100,
            [
                [215,70,70],
                [230,198,75],
                [85,169,108]
            ]
        );

    }


    return "#4b83d1";

}


/* =========================================================
   LEGENDA
========================================================= */

function updateLegend() {

    const title =
        document.getElementById(
            "legendTitle"
        );

    const bar =
        document.getElementById(
            "legendBar"
        );

    const low =
        document.getElementById(
            "legendLow"
        );

    const high =
        document.getElementById(
            "legendHigh"
        );


    bar.className =
        "legend-bar";


    if (activeLayer === "price") {

        title.textContent =
            "Ceny nemovitostí";

        bar.classList.add(
            "price-gradient"
        );

        low.textContent = "levnější";
        high.textContent = "dražší";

    }


    if (activeLayer === "rent") {

        title.textContent =
            "Nájmy";

        bar.classList.add(
            "rent-gradient"
        );

        low.textContent = "nižší";
        high.textContent = "vyšší";

    }


    if (activeLayer === "green") {

        title.textContent =
            "Zeleň";

        bar.classList.add(
            "green-gradient"
        );

        low.textContent =
            "méně zeleně";

        high.textContent =
            "více zeleně";

    }


    if (activeLayer === "noise") {

        title.textContent =
            "Hluk";

        bar.classList.add(
            "noise-gradient"
        );

        low.textContent =
            "klid";

        high.textContent =
            "hluk";

    }


    if (activeLayer === "safety") {

        title.textContent =
            "Bezpečnost";

        bar.classList.add(
            "safety-gradient"
        );

        low.textContent =
            "nižší";

        high.textContent =
            "vyšší";

    }

}


/* =========================================================
   RÚIAN API
========================================================= */

async function fetchRuian(layerId) {

    const bounds =
        map.getBounds();


    const xmin =
        bounds.getWest();

    const ymin =
        bounds.getSouth();

    const xmax =
        bounds.getEast();

    const ymax =
        bounds.getNorth();


    const baseParams = {

        where: "1=1",

        geometry:
            `${xmin},${ymin},${xmax},${ymax}`,

        geometryType:
            "esriGeometryEnvelope",

        inSR: "4326",

        spatialRel:
            "esriSpatialRelIntersects",

        outFields: "*",

        returnGeometry: "true",

        outSR: "4326",

        f: "geojson",

        resultRecordCount: "1000"

    };


    let features = [];

    let offset = 0;

    const maxFeatures =
        currentZoomLevel > 12.5
            ? 3000
            : 5000;


    while (
        offset < maxFeatures
    ) {

        const params =
            new URLSearchParams(
                baseParams
            );

        params.set(
            "resultOffset",
            String(offset)
        );


        const url =
            `${RUIAN}/${layerId}/query?${params}`;


        const response =
            await fetch(url);


        if (!response.ok) {

            throw new Error(
                "ČÚZK RÚIAN API není dostupné."
            );

        }


        const data =
            await response.json();


        if (data.error) {

            throw new Error(
                data.error.message ||
                "Chyba ČÚZK API."
            );

        }


        const batch =
            data.features || [];


        features =
            features.concat(batch);


        if (
            !data.exceededTransferLimit ||
            batch.length === 0
        ) {

            break;

        }


        offset += batch.length;

    }


    return {
        type: "FeatureCollection",
        features
    };

}


/* =========================================================
   VYKRESLENÍ POLYGONŮ
========================================================= */

async function renderZones() {

    const requestId =
        ++requestCounter;


    currentZoomLevel =
        map.getZoom();


    const level =
        getMapLevel(
            currentZoomLevel
        );


    showLoading(
        `Načítám ${level.name.toLowerCase()}...`
    );


    try {

        const geojson =
            await fetchRuian(
                level.id
            );


        if (
            requestId !== requestCounter
        ) {

            return;

        }


        if (zoneLayer) {

            map.removeLayer(
                zoneLayer
            );

        }


        zoneLayer =
            L.geoJSON(
                geojson,
                {

                    style: function(feature) {

                        return {

                            color: "#ffffff",

                            weight:
                                currentZoomLevel > 12.5
                                    ? 0.6
                                    : 1,

                            opacity: 0.8,

                            fillColor:
                                getPolygonColor(
                                    feature
                                ),

                            fillOpacity: 0.62

                        };

                    },


                    onEachFeature:
                        function(
                            feature,
                            layer
                        ) {

                            const name =
                                featureName(
                                    feature
                                );


                            layer.bindTooltip(
                                name,
                                {
                                    sticky: true
                                }
                            );


                            layer.on(
                                "mouseover",
                                function() {

                                    layer.setStyle({

                                        weight: 2,

                                        color:
                                            "#111827",

                                        fillOpacity:
                                            0.78

                                    });

                                }
                            );


                            layer.on(
                                "mouseout",
                                function() {

                                    zoneLayer.resetStyle(
                                        layer
                                    );

                                }
                            );


                            layer.on(
                                "click",
                                function() {

                                    openFeatureDetail(
                                        feature,
                                        level.name
                                    );

                                }
                            );

                        }

                }
            );


        zoneLayer.addTo(map);


        hideLoading();
        hideError();


    } catch (error) {

        console.error(error);

        hideLoading();

        showError(
            "Mapová data se nepodařilo načíst. Klikni sem pro zavření."
        );

    }

}


/* =========================================================
   DETAIL POLYGONU
========================================================= */

function openFeatureDetail(
    feature,
    levelName
) {

    selectedFeature =
        feature;


    const name =
        featureName(
            feature
        );


    document
        .getElementById(
            "detailLevel"
        )
        .textContent =
            levelName.toUpperCase();


    document
        .getElementById(
            "detailName"
        )
        .textContent =
            name;


    const metric =
        getMetric(
            feature,
            activeLayer
        );


    let html = "";


    /* -------------------------
       HLAVNÍ HODNOTA
    ------------------------- */

    html += `
        <div class="hero-metric">

            <span>
                ${getLayerTitle(activeLayer)}
            </span>

            <strong>
                ${formatMetric(
                    metric.value,
                    activeLayer
                )}
            </strong>

            <small>
                ${metric.label}
            </small>

        </div>
    `;


    /* -------------------------
       DEMO UPOZORNĚNÍ
    ------------------------- */

    if (!metric.real) {

        html += `
            <div class="data-warning">

                <strong>DEMO DATA.</strong>

                Tato hodnota je pouze
                analytická ukázka pro
                vykreslení mapy.

                Nejde o skutečnou
                statistickou hodnotu
                daného území.

            </div>
        `;

    }


    /* -------------------------
       DALŠÍ INDEXY
    ------------------------- */

    html += `

        <div class="score-grid">

            <div class="score">
                <span>Zeleň</span>
                <strong>
                    ${Math.round(
                        getMetric(
                            feature,
                            "green"
                        ).value
                    )} %
                </strong>
            </div>

            <div class="score">
                <span>Hluk</span>
                <strong>
                    ${Math.round(
                        getMetric(
                            feature,
                            "noise"
                        ).value
                    )}/100
                </strong>
            </div>

            <div class="score">
                <span>Bezpečnost</span>
                <strong>
                    ${Math.round(
                        getMetric(
                            feature,
                            "safety"
                        ).value
                    )}/100
                </strong>
            </div>

            <div class="score">
                <span>Úroveň</span>
                <strong>
                    ${levelName}
                </strong>
            </div>

        </div>
    `;


    /* -------------------------
       INFORMACE
    ------------------------- */

    html += `

        <div class="detail-section">

            <h3>
                O lokalitě
            </h3>

            <p>
                Tato zóna vychází z
                administrativních hranic
                RÚIAN. Po přiblížení mapy
                se zobrazí podrobnější
                územní jednotky.
            </p>

        </div>


        <div class="detail-section">

            <h3>
                Poznámky
            </h3>

            <ul>

                <li>
                    Hranice:
                    ČÚZK / RÚIAN
                </li>

                <li>
                    Ceny a nájmy krajských
                    měst: RealityMIX 09/2026
                </li>

                <li>
                    Celostátní DEMO indexy
                    nejsou oficiální statistika.
                </li>

            </ul>

        </div>


        <div class="source">

            Zdroj hranic:
            ČÚZK / RÚIAN

            <br>

            Ceny a nájmy:
            RealityMIX

            <br>

            Školy:
            OpenStreetMap / Overpass API

        </div>
    `;


    document
        .getElementById(
            "detailContent"
        )
        .innerHTML =
            html;


    document
        .getElementById(
            "detailPanel"
        )
        .classList.remove(
            "hidden"
        );

}


/* =========================================================
   TITUL VRSTVY
========================================================= */

function getLayerTitle(layer) {

    const titles = {

        price:
            "Průměrná nabídková cena bytu",

        rent:
            "Nájem za 1 m² / měsíc",

        green:
            "Podíl zeleně",

        noise:
            "Index hluku",

        safety:
            "Index bezpečnosti"

    };

    return titles[layer] ||
        "Hodnota";

}


/* =========================================================
   FORMÁTOVÁNÍ METRIKY
========================================================= */

function formatMetric(
    value,
    layer
) {

    if (layer === "price") {

        return (
            formatNumber(
                Math.round(value)
            ) +
            " Kč/m²"
        );

    }


    if (layer === "rent") {

        return (
            formatNumber(
                Math.round(value)
            ) +
            " Kč/m²/měsíc"
        );

    }


    if (layer === "green") {

        return (
            Math.round(value) +
            " %"
        );

    }


    return (
        Math.round(value) +
        " / 100"
    );

}


/* =========================================================
   ŠKOLY — OVERPASS
========================================================= */

async function fetchSchools() {

    if (
        map.getZoom() < 9
    ) {

        showError(
            "Školy se zobrazují až při větším přiblížení mapy."
        );

        document
            .getElementById(
                "schoolsToggle"
            )
            .checked = false;

        schoolsEnabled = false;

        return;

    }


    showLoading(
        "Načítám školy..."
    );


    const bounds =
        map.getBounds();


    const south =
        bounds.getSouth();

    const west =
        bounds.getWest();

    const north =
        bounds.getNorth();

    const east =
        bounds.getEast();


    const query = `

        [out:json][timeout:20];

        (

            node["amenity"="school"]
            (${south},${west},${north},${east});

            way["amenity"="school"]
            (${south},${west},${north},${east});

            relation["amenity"="school"]
            (${south},${west},${north},${east});

        );

        out center tags;

    `;


    try {

        const response =
            await fetch(
                OVERPASS +
                "?data=" +
                encodeURIComponent(
                    query
                )
            );


        if (!response.ok) {

            throw new Error(
                "Overpass není dostupný."
            );

        }


        const data =
            await response.json();


        if (schoolLayer) {

            map.removeLayer(
                schoolLayer
            );

        }


        schoolLayer =
            L.layerGroup();


        data.elements.forEach(
            function(element) {

                let lat;
                let lng;


                if (
                    element.lat &&
                    element.lon
                ) {

                    lat =
                        element.lat;

                    lng =
                        element.lon;

                } else if (
                    element.center
                ) {

                    lat =
                        element.center.lat;

                    lng =
                        element.center.lon;

                } else {

                    return;

                }


                const name =
                    element.tags &&
                    element.tags.name
                        ? element.tags.name
                        : "Škola";


                const marker =
                    L.circleMarker(
                        [lat,lng],
                        {

                            radius: 6,

                            color: "#ffffff",

                            weight: 2,

                            fillColor:
                                "#2563eb",

                            fillOpacity: 0.9

                        }
                    );


                marker.bindTooltip(
                    name
                );


                marker.on(
                    "click",
                    function() {

                        openSchoolDetail(
                            name
                        );

                    }
                );


                marker.addTo(
                    schoolLayer
                );

            }
        );


        schoolLayer.addTo(
            map
        );


        hideLoading();


    } catch (error) {

        console.error(error);

        hideLoading();

        showError(
            "Školy se nepodařilo načíst."
        );

    }

}


/* =========================================================
   DETAIL ŠKOLY
========================================================= */

function openSchoolDetail(
    name
) {

    document
        .getElementById(
            "detailLevel"
        )
        .textContent =
            "ŠKOLSKÉ ZAŘÍZENÍ";


    document
        .getElementById(
            "detailName"
        )
        .textContent =
            name;


    document
        .getElementById(
            "detailContent"
        )
        .innerHTML = `

            <div class="hero-metric">

                <span>
                    Typ bodu
                </span>

                <strong>
                    Škola
                </strong>

                <small>
                    OpenStreetMap / Overpass
                </small>

            </div>


            <div class="detail-section">

                <h3>
                    Informace
                </h3>

                <p>
                    Tento bod představuje
                    školské zařízení
                    evidované v
                    OpenStreetMap.
                </p>

            </div>

        `;


    document
        .getElementById(
            "detailPanel"
        )
        .classList.remove(
            "hidden"
        );

}


/* =========================================================
   ZMĚNA VRSTVY
========================================================= */

function changeActiveLayer(
    layer
) {

    if (layer === "schools") {
        return;
    }


    activeLayer =
        layer;


    document
        .querySelectorAll(
            ".layer-row"
        )
        .forEach(
            function(row) {

                row.classList.remove(
                    "active"
                );

            }
        );


    const selectedRow =
        document.querySelector(
            `.layer-row[data-layer="${layer}"]`
        );


    if (selectedRow) {

        selectedRow.classList.add(
            "active"
        );

    }


    updateLegend();


    renderZones();

}


/* =========================================================
   VYHLEDÁVÁNÍ
========================================================= */

function searchLocal(text) {

    const value =
        text
            .trim()
            .toLowerCase();


    if (!value) {

        return [];

    }


    return CAPITALS
        .filter(
            function(capital) {

                return (
                    capital.name
                        .toLowerCase()
                        .includes(value) ||

                    capital.region
                        .toLowerCase()
                        .includes(value)
                );

            }
        )
        .slice(0,7);

}


/* =========================================================
   VÝSLEDKY VYHLEDÁVÁNÍ
========================================================= */

function renderSearchResults(
    results
) {

    const container =
        document.getElementById(
            "searchResults"
        );


    if (
        !results.length
    ) {

        container.style.display =
            "none";

        container.innerHTML =
            "";

        return;

    }


    container.innerHTML =
        results
            .map(
                function(item) {

                    return `

                        <div
                            class="search-result"
                            data-city="${item.name}"
                        >

                            <strong>
                                ${item.name}
                            </strong>

                            <span>
                                ${item.region}
                            </span>

                        </div>

                    `;

                }
            )
            .join("");


    container.style.display =
        "block";


    container
        .querySelectorAll(
            ".search-result"
        )
        .forEach(
            function(element) {

                element.addEventListener(
                    "mousedown",
                    function() {

                        const city =
                            element.dataset.city;

                        const capital =
                            CAPITALS.find(
                                function(item) {
                                    return item.name === city;
                                }
                            );


                        if (capital) {

                            selectCapital(
                                capital
                            );

                        }

                    }
                );

            }
        );

}


/* =========================================================
   VÝBĚR KRAJSKÉHO MĚSTA
========================================================= */

function selectCapital(
    capital
) {

    document
        .getElementById(
            "searchInput"
        )
        .value =
            capital.name;


    document
        .getElementById(
            "searchResults"
        )
        .style.display =
            "none";


    activeLayer =
        "price";


    updateLegend();


    document
        .querySelectorAll(
            ".layer-row"
        )
        .forEach(
            function(row) {

                row.classList.remove(
                    "active"
                );

            }
        );


    document
        .querySelector(
            '.layer-row[data-layer="price"]'
        )
        .classList.add(
            "active"
        );


    map.flyTo(
        [
            capital.lat,
            capital.lng
        ],
        11.5,
        {
            duration: 1.1
        }
    );


    openFeatureDetail(

        {
            properties: {
                nazev:
                    capital.name
            }
        },

        "Krajské město"

    );

}


/* =========================================================
   NOMINATIM
========================================================= */

async function searchNominatim(
    query
) {

    showLoading(
        "Hledám místo..."
    );


    try {

        const params =
            new URLSearchParams({

                q:
                    query +
                    ", Česko",

                format:
                    "jsonv2",

                countrycodes:
                    "cz",

                limit:
                    "1",

                "accept-language":
                    "cs"

            });


        const response =
            await fetch(
                NOMINATIM +
                "?" +
                params.toString()
            );


        if (!response.ok) {

            throw new Error(
                "Vyhledávání není dostupné."
            );

        }


        const data =
            await response.json();


        if (!data.length) {

            throw new Error(
                "Místo nebylo nalezeno."
            );

        }


        const result =
            data[0];


        const lat =
            Number(result.lat);

        const lon =
            Number(result.lon);


        map.flyTo(
            [lat,lon],
            14,
            {
                duration: 1.1
            }
        );


        document
            .getElementById(
                "detailLevel"
            )
            .textContent =
                "VYHLEDANÉ MÍSTO";


        document
            .getElementById(
                "detailName"
            )
            .textContent =
                result.display_name;


        document
            .getElementById(
                "detailContent"
            )
            .innerHTML = `

                <div class="hero-metric">

                    <span>
                        Vyhledané místo
                    </span>

                    <strong>
                        Místo nalezeno
                    </strong>

                    <small>
                        OpenStreetMap / Nominatim
                    </small>

                </div>

            `;


        document
            .getElementById(
                "detailPanel"
            )
            .classList.remove(
                "hidden"
            );


        hideLoading();


    } catch (error) {

        hideLoading();

        showError(
            error.message ||
            "Místo se nepodařilo najít."
        );

    }

}


/* =========================================================
   KRAJE — FLY TO
========================================================= */

const REGION_CENTERS = {

    all:
        [49.7437,15.3386],

    praha:
        [50.0755,14.4378],

    stredocesky:
        [50.0755,14.4378],

    jihocesky:
        [48.9745,14.4743],

    plzensky:
        [49.7384,13.3736],

    karlovarsky:
        [50.2319,12.8714],

    ustecky:
        [50.6607,14.0323],

    liberecky:
        [50.7671,15.0562],

    kralovehradecky:
        [50.2092,15.8328],

    pardubicky:
        [50.0343,15.7812],

    vysocina:
        [49.3961,15.5912],

    jihomoravsky:
        [49.1951,16.6068],

    olomoucky:
        [49.5938,17.2509],

    zlinsky:
        [49.2265,17.668],

    moravskoslezsky:
        [49.8209,18.2625]

};


function selectRegion(
    value
) {

    const center =
        REGION_CENTERS[value];


    if (!center) {
        return;
    }


    if (value === "all") {

        map.flyTo(
            center,
            7.5,
            {
                duration: 1
            }
        );

        return;

    }


    map.flyTo(
        center,
        9.8,
        {
            duration: 1
        }
    );

}


/* =========================================================
   INICIALIZACE MAPY
========================================================= */

function initializeMap() {

    if (
        typeof L ===
        "undefined"
    ) {

        showError(
            "Leaflet se nepodařilo načíst. Zkontroluj připojení k internetu."
        );

        return;

    }


    map =
        L.map(
            "map",
            {

                center:
                    [49.7437,15.3386],

                zoom:
                    7.5,

                minZoom:
                    6,

                maxZoom:
                    16,

                zoomControl:
                    false,

                preferCanvas:
                    true

            }
        );


    L.control
        .zoom(
            {
                position:
                    "bottomright"
            }
        )
        .addTo(map);


    L.tileLayer(
        OSM,
        {

            maxZoom:
                19,

            attribution:
                "&copy; OpenStreetMap contributors"

        }
    )
    .addTo(map);


    map.on(
        "zoomend",
        function() {

            currentZoomLevel =
                map.getZoom();

            renderZones();


            if (
                schoolsEnabled
            ) {

                fetchSchools();

            }

        }
    );


    map.on(
        "moveend",
        function() {

            if (
                schoolsEnabled
            ) {

                fetchSchools();

            }

        }
    );


    renderZones();

}


/* =========================================================
   EVENT LISTENERY
========================================================= */

function initializeEvents() {


    /* -------------------------
       VRSTVY
    ------------------------- */

    document
        .querySelectorAll(
            ".layer-row"
        )
        .forEach(
            function(row) {

                row.addEventListener(
                    "click",
                    function(event) {

                        const layer =
                            row.dataset.layer;


                        if (
                            layer ===
                            "schools"
                        ) {

                            return;

                        }


                        changeActiveLayer(
                            layer
                        );


                        const radio =
                            row.querySelector(
                                "input"
                            );


                        if (radio) {

                            radio.checked =
                                true;

                        }

                    }
                );

            }
        );


    /* -------------------------
       ŠKOLY
    ------------------------- */

    document
        .getElementById(
            "schoolsToggle"
        )
        .addEventListener(
            "change",
            function(event) {

                schoolsEnabled =
                    event.target.checked;


                if (
                    schoolsEnabled
                ) {

                    fetchSchools();

                } else {

                    if (
                        schoolLayer
                    ) {

                        map.removeLayer(
                            schoolLayer
                        );

                    }

                }

            }
        );


    /* -------------------------
       DETAIL CLOSE
    ------------------------- */

    document
        .getElementById(
            "closeDetail"
        )
        .addEventListener(
            "click",
            function() {

                document
                    .getElementById(
                        "detailPanel"
                    )
                    .classList.add(
                        "hidden"
                    );

            }
        );


    /* -------------------------
       ERROR CLOSE
    ------------------------- */

    document
        .getElementById(
            "errorBox"
        )
        .addEventListener(
            "click",
            hideError
        );


    /* -------------------------
       REGION
    ------------------------- */

    document
        .getElementById(
            "regionSelect"
        )
        .addEventListener(
            "change",
            function(event) {

                selectRegion(
                    event.target.value
                );

            }
        );


    /* -------------------------
       SEARCH INPUT
    ------------------------- */

    const searchInput =
        document.getElementById(
            "searchInput"
        );


    searchInput.addEventListener(
        "input",
        function(event) {

            const results =
                searchLocal(
                    event.target.value
                );


            renderSearchResults(
                results
            );

        }
    );


    /* -------------------------
       SEARCH FORM
    ------------------------- */

    document
        .getElementById(
            "searchForm"
        )
        .addEventListener(
            "submit",
            async function(event) {

                event.preventDefault();


                const value =
                    searchInput
                        .value
                        .trim();


                if (!value) {
                    return;
                }


                const capital =
                    CAPITALS.find(
                        function(item) {

                            return (
                                item.name
                                    .toLowerCase() ===
                                value.toLowerCase()
                            );

                        }
                    );


                if (capital) {

                    selectCapital(
                        capital
                    );

                    return;

                }


                await searchNominatim(
                    value
                );

            }
        );


    /* -------------------------
       OVERVIEW
    ------------------------- */

    document
        .getElementById(
            "overviewButton"
        )
        .addEventListener(
            "click",
            function() {

                document
                    .getElementById(
                        "detailLevel"
                    )
                    .textContent =
                        "PŘEHLED ČR";


                document
                    .getElementById(
                        "detailName"
                    )
                    .textContent =
                        "Mapa bydlení ČR";


                document
                    .getElementById(
                        "detailContent"
                    )
                    .innerHTML = `

                        <div class="hero-metric">

                            <span>
                                Mapový systém
                            </span>

                            <strong>
                                Celá ČR
                            </strong>

                            <small>
                                kraje · okresy · obce · katastry
                            </small>

                        </div>


                        <div class="score-grid">

                            <div class="score">
                                <span>
                                    Aktivní vrstva
                                </span>

                                <strong>
                                    ${getLayerTitle(
                                        activeLayer
                                    )}
                                </strong>
                            </div>


                            <div class="score">
                                <span>
                                    Úroveň
                                </span>

                                <strong>
                                    ${getMapLevel(
                                        map.getZoom()
                                    ).name}
                                </strong>
                            </div>

                        </div>


                        <div class="data-warning">

                            Hranice území jsou
                            načítány z ČÚZK / RÚIAN.

                            Celostátní indexy zeleně,
                            hluku a bezpečnosti jsou
                            v této verzi označené
                            jako DEMO.

                        </div>

                    `;


                document
                    .getElementById(
                        "detailPanel"
                    )
                    .classList.remove(
                        "hidden"
                    );

            }
        );


    /* -------------------------
       SEARCH CLICK OUTSIDE
    ------------------------- */

    document.addEventListener(
        "click",
        function(event) {

            if (
                !event.target.closest(
                    ".search"
                )
            ) {

                document
                    .getElementById(
                        "searchResults"
                    )
                    .style.display =
                        "none";

            }

        }
    );

}


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        updateLegend();

        initializeMap();

        initializeEvents();

    }
);

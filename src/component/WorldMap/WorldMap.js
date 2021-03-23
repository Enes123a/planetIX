import ReactMapboxGl, {
  Layer,
  ZoomControl,
  Source,
} from "react-mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {updateTiles} from '../../data/tilesData';

const Map = ReactMapboxGl({
  accessToken: `pk.eyJ1IjoiZGFqbWFwdSIsImEiOiJja21nMmc2cWIzYXl0MnBqeDR5NWdydXF0In0.WXBO7Y50hQH6d0-8MsUCFQ`,
});

const WorldMap = () => {
  const updateMap = (map) => {
    updateTiles(map);
  };

  const getTileData = (map,e) => {
    const features = map.queryRenderedFeatures(e.point, {layers: ['tiles-shade']});
    console.log(features)
  };

  return  <Map
        onMoveEnd={(map) => updateMap(map)}
        style={'mapbox://styles/mapbox/streets-v9'}
        containerStyle={{
          height: "100vh",
          width: "100vw",
        }}
        zoom={[0]}
        onClick={(map,e) => getTileData(map,e)}
      >
        <ZoomControl />
        <Source
          id="tiles-geojson"
          geoJsonSource={{
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [],
            },
          }}
        />
        <Layer
          id="tiles"
          type="line"
          sourceId="tiles-geojson"
          paint={{ "line-color": "#000" }}
        />
        <Layer
          id="tiles-shade"
          type="fill"
          sourceId="tiles-geojson"
          paint={{
            "fill-color": [
              "case",
              ["get", "even"],
              "rgba(0,0,0,0.1)",
              "rgba(0,0,0,0)",
            ],
          }}
        />
        <Source
          id="tiles-centers-geojson"
          geoJsonSource={{
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [],
            },
          }}
        />
        <Layer
          id="tiles-centers"
          type="symbol"
          sourceId="tiles-centers-geojson"
          layout={{
            "text-field": ["format", ["get", "text"], { "font-scale": 1.2 }],
            "text-offset": [0, -1],
          }}
          paint={{
            "text-color": "#000",
            "text-color-transition": {
              duration: 0,
            },
            "text-halo-color": "#fff",
            "text-halo-width": 0.5,
          }}
        />
      </Map>
  
};

export default WorldMap;

import tilebelt from "@mapbox/tilebelt";
import area from "@turf/area";

export const getTiles=(geom, limits)=> {
    var i,
      tile,
      coords = geom.coordinates,
      maxZoom = limits.max_zoom,
      tileHash = {},
      tiles = [];
  
    if (geom.type === "Point") {
      return [tilebelt.pointToTile(coords[0], coords[1], maxZoom)];
    } else if (geom.type === "MultiPoint") {
      for (i = 0; i < coords.length; i++) {
        tile = tilebelt.pointToTile(coords[i][0], coords[i][1], maxZoom);
        tileHash[toID(tile[0], tile[1], tile[2])] = true;
      }
    } else if (geom.type === "LineString") {
      lineCover(tileHash, coords, maxZoom);
    } else if (geom.type === "MultiLineString") {
      for (i = 0; i < coords.length; i++) {
        lineCover(tileHash, coords[i], maxZoom);
      }
    } else if (geom.type === "Polygon") {
      polygonCover(tileHash, tiles, coords, maxZoom);
    } else if (geom.type === "MultiPolygon") {
      for (i = 0; i < coords.length; i++) {
        polygonCover(tileHash, tiles, coords[i], maxZoom);
      }
    } else {
      throw new Error("Geometry type not implemented");
    }
  
    if (limits.min_zoom !== maxZoom) {
      // sync tile hash and tile array so that both contain the same tiles
      var len = tiles.length;
      appendHashTiles(tileHash, tiles);
      for (i = 0; i < len; i++) {
        var t = tiles[i];
        tileHash[toID(t[0], t[1], t[2])] = true;
      }
      return mergeTiles(tileHash, tiles, limits);
    }
    appendHashTiles(tileHash, tiles);
    return tiles;
  }
  
  export const appendHashTiles=(hash, tiles)=> {
    var keys = Object.keys(hash);
    for (var i = 0; i < keys.length; i++) {
      tiles.push(fromID(+keys[i]));
    }
  }
  
  export const lineCover=(tileHash, coords, maxZoom, ring)=> {
    var prevX, prevY;
  
    for (var i = 0; i < coords.length - 1; i++) {
      var start = tilebelt.pointToTileFraction(
          coords[i][0],
          coords[i][1],
          maxZoom
        ),
        stop = tilebelt.pointToTileFraction(
          coords[i + 1][0],
          coords[i + 1][1],
          maxZoom
        ),
        x0 = start[0],
        y0 = start[1],
        x1 = stop[0],
        y1 = stop[1],
        dx = x1 - x0,
        dy = y1 - y0;
  
      if (dy === 0 && dx === 0) continue;
  
      var sx = dx > 0 ? 1 : -1,
        sy = dy > 0 ? 1 : -1,
        x = Math.floor(x0),
        y = Math.floor(y0),
        tMaxX = dx === 0 ? Infinity : Math.abs(((dx > 0 ? 1 : 0) + x - x0) / dx),
        tMaxY = dy === 0 ? Infinity : Math.abs(((dy > 0 ? 1 : 0) + y - y0) / dy),
        tdx = Math.abs(sx / dx),
        tdy = Math.abs(sy / dy);
  
      if (x !== prevX || y !== prevY) {
        tileHash[toID(x, y, maxZoom)] = true;
        if (ring && y !== prevY) ring.push([x, y]);
        prevX = x;
        prevY = y;
      }
  
      while (tMaxX < 1 || tMaxY < 1) {
        if (tMaxX < tMaxY) {
          tMaxX += tdx;
          x += sx;
        } else {
          tMaxY += tdy;
          y += sy;
        }
        tileHash[toID(x, y, maxZoom)] = true;
        if (ring && y !== prevY) ring.push([x, y]);
        prevX = x;
        prevY = y;
      }
    }
  
    if (ring && y === ring[0][1]) ring.pop();
  }
  
  export const polygonCover=(tileHash, tileArray, geom, zoom)=> {
    var intersections = [];
  
    for (var i = 0; i < geom.length; i++) {
      var ring = [];
      lineCover(tileHash, geom[i], zoom, ring);
  
      for (var j = 0, len = ring.length, k = len - 1; j < len; k = j++) {
        var m = (j + 1) % len;
        var y = ring[j][1];
  
        // add interesction if it's not local extremum or duplicate
        if (
          (y > ring[k][1] || y > ring[m][1]) && // not local minimum
          (y < ring[k][1] || y < ring[m][1]) && // not local maximum
          y !== ring[m][1]
        )
          intersections.push(ring[j]);
      }
    }
  
    intersections.sort(compareTiles); // sort by y, then x
  
    for (i = 0; i < intersections.length; i += 2) {
      // fill tiles between pairs of intersections
      y = intersections[i][1];
      for (var x = intersections[i][0] + 1; x < intersections[i + 1][0]; x++) {
        var id = toID(x, y, zoom);
        if (!tileHash[id]) {
          tileArray.push([x, y, zoom]);
        }
      }
    }
  }
  
  export const toID=(x, y, z)=> {
    var dim = 2 * (1 << z);
    return (dim * y + x) * 32 + z;
  }
  
  export const mergeTiles=(tileHash, tiles, limits)=> {
    var mergedTiles = [];
  
    for (var z = limits.max_zoom; z > limits.min_zoom; z--) {
      var parentTileHash = {};
      var parentTiles = [];
  
      for (var i = 0; i < tiles.length; i++) {
        var t = tiles[i];
  
        if (t[0] % 2 === 0 && t[1] % 2 === 0) {
          var id2 = toID(t[0] + 1, t[1], z),
            id3 = toID(t[0], t[1] + 1, z),
            id4 = toID(t[0] + 1, t[1] + 1, z);
  
          if (tileHash[id2] && tileHash[id3] && tileHash[id4]) {
            tileHash[toID(t[0], t[1], t[2])] = false;
            tileHash[id2] = false;
            tileHash[id3] = false;
            tileHash[id4] = false;
  
            var parentTile = [t[0] / 2, t[1] / 2, z - 1];
  
            if (z - 1 === limits.min_zoom) mergedTiles.push(parentTile);
            else {
              parentTileHash[toID(t[0] / 2, t[1] / 2, z - 1)] = true;
              parentTiles.push(parentTile);
            }
          }
        }
      }
  
      for (i = 0; i < tiles.length; i++) {
        t = tiles[i];
        if (tileHash[toID(t[0], t[1], t[2])]) mergedTiles.push(t);
      }
  
      tileHash = parentTileHash;
      tiles = parentTiles;
    }
  
    return mergedTiles;
  }
  
  export const fromID=(id)=> {
    var z = id % 32,
      dim = 2 * (1 << z),
      xy = (id - z) / 32,
      x = xy % dim,
      y = ((xy - x) / dim) % dim;
    return [x, y, z];
  }
  
  export const compareTiles=(a, b)=> {
    return a[1] - b[1] || a[0] - b[0];
  }



export const getExtentsGeom = (map) => {
  var e = map.getBounds();
  var box = [
    e.getSouthWest().toArray(),
    e.getNorthWest().toArray(),
    e.getNorthEast().toArray(),
    e.getSouthEast().toArray(),
    e.getSouthWest().toArray(),
  ].map((coords) => {
    if (coords[0] < -180) return [-179.99999, coords[1]];
    if (coords[0] > 180) return [179.99999, coords[1]];
    return coords;
  });

  return {
    type: "Polygon",
    coordinates: [box],
  };
};

export const updateTiles = (map) => {
  var extentsGeom = getExtentsGeom(map);
  var zoom = Math.ceil(map.getZoom());
  getTiles(extentsGeom, {
    min_zoom: zoom,
    max_zoom: zoom,
  });
  const tiles = getTiles(extentsGeom, {
    min_zoom: zoom,
    max_zoom: zoom,
  });

  map.getSource("tiles-geojson").setData({
    type: "FeatureCollection",
    features: tiles.map(getTileFeature),
  });
  map.getSource("tiles-centers-geojson").setData({
    type: "FeatureCollection",
    features: tiles.map(getTileCenterFeature),
  });
};

export const getTileFeature = (tile) => {
  var quadkey = tilebelt.tileToQuadkey(tile);

  var feature = {
    type: "Feature",
    properties: {
      even: (tile[0] + tile[1]) % 2 === 0,
      quadkey: quadkey,
    },
    geometry: tilebelt.tileToGeoJSON(tile),
  };
  return feature;
};

export const getTileCenterFeature = (tile) => {
  var box = tilebelt.tileToBBOX(tile);
  var center = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];

  var quadkey = tilebelt.tileToQuadkey(tile);
  var tileArea = area(tilebelt.tileToGeoJSON(tile)); // area in sq meters
  var areaSqKm = tileArea / 1000 ** 2;
  var areaString = "";
  if (areaSqKm > 1) {
    areaString = Math.round(areaSqKm, 2).toLocaleString() + "sq km";
  } else {
    areaString =
      Math.round(areaSqKm * 1000000, 2).toLocaleString() + " sq meters";
  }
  return {
    type: "Feature",
    properties: {
      text:
        "Tile (x,y,z): " +
        JSON.stringify(tile) +
        "\nQuadkey: " +
        quadkey +
        "\nZoom: " +
        tile[2] +
        "\nArea: " +
        areaString,
      quadkey: quadkey,
    },
    geometry: {
      type: "Point",
      coordinates: center,
    },
  };
};

export const getTileData = (map, e) => {
  const features = map.queryRenderedFeatures(e.point, {
    layers: ["tiles-shade"],
  });
  console.log(features);
};

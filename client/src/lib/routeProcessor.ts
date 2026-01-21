/**
 * Route Processor - Chinese Postman Problem Implementation
 * Generates optimized trash collection routes from OSM data
 * 
 * Design: Command Center Interface
 * - Processes OSM XML files in the browser
 * - Implements Hierholzer's algorithm with right-turn preference
 * - Exports routes as GPX files
 */

export interface OSMNode {
  id: number;
  lat: number;
  lon: number;
}

export interface OSMWay {
  id: number;
  nodes: number[];
  tags: Record<string, string>;
}

export interface GraphEdge {
  from: number;
  to: number;
  length: number;
  bearing: number;
  wayId: number;
  highway: string;
  name: string;
}

export interface RouteStats {
  totalDistanceKm: number;
  totalTraversals: number;
  driveTimeMin: number;
  nodeCount: number;
  edgeCount: number;
  connectedComponents: number;
  includedWays: number;
  excludedWays: number;
  uTurnCount: number;
  rightTurnCount: number;
  leftTurnCount: number;
}

export interface ProcessingLog {
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface RouteResult {
  gpxContent: string;
  stats: RouteStats;
  logs: ProcessingLog[];
  coordinates: Array<{ lat: number; lon: number }>;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

// Highway types to include
const INCLUDE_HIGHWAYS = new Set([
  'residential', 'unclassified', 'service', 'tertiary', 
  'secondary', 'primary', 'living_street'
]);

// Exclusions
const EXCLUDE_SERVICE = new Set(['parking_aisle', 'driveway']);
const EXCLUDE_ACCESS = new Set(['private', 'no']);
const EXCLUDE_HIGHWAYS = new Set([
  'footway', 'cycleway', 'steps', 'path', 'pedestrian', 'track'
]);

function createLog(message: string, type: ProcessingLog['type'] = 'info'): ProcessingLog {
  return { timestamp: new Date(), message, type };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) ** 2 + 
            Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const x = Math.sin(deltaLambda) * Math.cos(phi2);
  const y = Math.cos(phi1) * Math.sin(phi2) - 
            Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  let bearing = Math.atan2(x, y) * (180 / Math.PI);
  bearing = (bearing + 360) % 360;

  return bearing;
}

export function parseOSMFile(xmlContent: string): { nodes: Map<number, OSMNode>; ways: OSMWay[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');
  
  const nodes = new Map<number, OSMNode>();
  const ways: OSMWay[] = [];

  // Parse nodes
  const nodeElements = doc.querySelectorAll('node');
  nodeElements.forEach((node) => {
    const id = parseInt(node.getAttribute('id') || '0');
    const lat = parseFloat(node.getAttribute('lat') || '0');
    const lon = parseFloat(node.getAttribute('lon') || '0');
    nodes.set(id, { id, lat, lon });
  });

  // Parse ways
  const wayElements = doc.querySelectorAll('way');
  wayElements.forEach((way) => {
    const id = parseInt(way.getAttribute('id') || '0');
    const wayNodes: number[] = [];
    const tags: Record<string, string> = {};

    way.querySelectorAll('nd').forEach((nd) => {
      const ref = parseInt(nd.getAttribute('ref') || '0');
      wayNodes.push(ref);
    });

    way.querySelectorAll('tag').forEach((tag) => {
      const k = tag.getAttribute('k') || '';
      const v = tag.getAttribute('v') || '';
      tags[k] = v;
    });

    ways.push({ id, nodes: wayNodes, tags });
  });

  return { nodes, ways };
}

export function filterWays(ways: OSMWay[]): { included: OSMWay[]; excluded: OSMWay[] } {
  const included: OSMWay[] = [];
  const excluded: OSMWay[] = [];

  for (const way of ways) {
    const highway = way.tags.highway || '';
    
    // Check if it's a driveable highway
    if (!INCLUDE_HIGHWAYS.has(highway)) {
      if (EXCLUDE_HIGHWAYS.has(highway) || highway === '') {
        excluded.push(way);
        continue;
      }
    }

    // Check exclusions
    const service = way.tags.service || '';
    if (EXCLUDE_SERVICE.has(service)) {
      excluded.push(way);
      continue;
    }

    const access = way.tags.access || '';
    if (EXCLUDE_ACCESS.has(access)) {
      excluded.push(way);
      continue;
    }

    included.push(way);
  }

  return { included, excluded };
}

interface Graph {
  adjacency: Map<number, Array<{ to: number; key: number; data: GraphEdge }>>;
  nodes: Map<number, OSMNode>;
  edgeCount: number;
}

export function buildGraph(
  nodes: Map<number, OSMNode>, 
  ways: OSMWay[], 
  ignoreOneways: boolean
): Graph {
  const adjacency = new Map<number, Array<{ to: number; key: number; data: GraphEdge }>>();
  const graphNodes = new Map<number, OSMNode>();
  let edgeKey = 0;

  for (const way of ways) {
    const wayNodes = way.nodes;
    const isOneway = way.tags.oneway === 'yes';

    for (let i = 0; i < wayNodes.length - 1; i++) {
      const u = wayNodes[i];
      const v = wayNodes[i + 1];

      const nodeU = nodes.get(u);
      const nodeV = nodes.get(v);
      if (!nodeU || !nodeV) continue;

      graphNodes.set(u, nodeU);
      graphNodes.set(v, nodeV);

      const length = haversineDistance(nodeU.lat, nodeU.lon, nodeV.lat, nodeV.lon);
      const bearing = calculateBearing(nodeU.lat, nodeU.lon, nodeV.lat, nodeV.lon);

      const edgeData: GraphEdge = {
        from: u,
        to: v,
        length,
        bearing,
        wayId: way.id,
        highway: way.tags.highway || 'unknown',
        name: way.tags.name || 'unnamed'
      };

      // Add forward edge
      if (!adjacency.has(u)) adjacency.set(u, []);
      adjacency.get(u)!.push({ to: v, key: edgeKey++, data: edgeData });

      // Add reverse edge (for right-side collection or if not one-way)
      if (ignoreOneways || !isOneway) {
        const reverseData: GraphEdge = {
          ...edgeData,
          from: v,
          to: u,
          bearing: (bearing + 180) % 360
        };
        if (!adjacency.has(v)) adjacency.set(v, []);
        adjacency.get(v)!.push({ to: u, key: edgeKey++, data: reverseData });
      }
    }
  }

  return { adjacency, nodes: graphNodes, edgeCount: edgeKey };
}

function findLargestSCC(graph: Graph): { subgraph: Graph; componentCount: number } {
  const nodes = Array.from(graph.nodes.keys());
  const visited = new Set<number>();
  const finished: number[] = [];

  // First DFS pass
  function dfs1(node: number) {
    visited.add(node);
    const edges = graph.adjacency.get(node) || [];
    for (const edge of edges) {
      if (!visited.has(edge.to)) {
        dfs1(edge.to);
      }
    }
    finished.push(node);
  }

  for (const node of nodes) {
    if (!visited.has(node)) {
      dfs1(node);
    }
  }

  // Build reverse graph
  const reverseAdj = new Map<number, number[]>();
  const graphAdjEntries = Array.from(graph.adjacency.entries());
  for (const [from, edges] of graphAdjEntries) {
    for (const edge of edges) {
      if (!reverseAdj.has(edge.to)) reverseAdj.set(edge.to, []);
      reverseAdj.get(edge.to)!.push(from);
    }
  }

  // Second DFS pass on reverse graph
  visited.clear();
  const components: Set<number>[] = [];

  function dfs2(node: number, component: Set<number>) {
    visited.add(node);
    component.add(node);
    const neighbors = reverseAdj.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs2(neighbor, component);
      }
    }
  }

  while (finished.length > 0) {
    const node = finished.pop()!;
    if (!visited.has(node)) {
      const component = new Set<number>();
      dfs2(node, component);
      components.push(component);
    }
  }

  // Find largest component
  const largestComponent = components.reduce((a, b) => a.size > b.size ? a : b, new Set<number>());

  // Build subgraph
  const subAdjacency = new Map<number, Array<{ to: number; key: number; data: GraphEdge }>>();
  const subNodes = new Map<number, OSMNode>();
  let edgeCount = 0;

  const largestComponentArray = Array.from(largestComponent);
  for (const nodeId of largestComponentArray) {
    const node = graph.nodes.get(nodeId);
    if (node) subNodes.set(nodeId, node);

    const edges = graph.adjacency.get(nodeId) || [];
    const filteredEdges = edges.filter(e => largestComponent.has(e.to));
    if (filteredEdges.length > 0) {
      subAdjacency.set(nodeId, filteredEdges);
      edgeCount += filteredEdges.length;
    }
  }

  return {
    subgraph: { adjacency: subAdjacency, nodes: subNodes, edgeCount },
    componentCount: components.length
  };
}

function findClosestNode(graph: Graph, targetLat: number, targetLon: number): number {
  let minDist = Infinity;
  let closestNode: number = Array.from(graph.nodes.keys())[0];

  const nodeEntries = Array.from(graph.nodes.entries());
  for (const [id, node] of nodeEntries) {
    const dist = haversineDistance(targetLat, targetLon, node.lat, node.lon);
    if (dist < minDist) {
      minDist = dist;
      closestNode = id;
    }
  }

  return closestNode;
}

function findCentroidNode(graph: Graph): number {
  let sumLat = 0, sumLon = 0, count = 0;

  const nodeValues = Array.from(graph.nodes.values());
  for (const node of nodeValues) {
    sumLat += node.lat;
    sumLon += node.lon;
    count++;
  }

  const centroidLat = sumLat / count;
  const centroidLon = sumLon / count;

  let minDist = Infinity;
  let closestNode: number = Array.from(graph.nodes.keys())[0];

  const nodeEntries = Array.from(graph.nodes.entries());
  for (const [id, node] of nodeEntries) {
    const dist = haversineDistance(centroidLat, centroidLon, node.lat, node.lon);
    if (dist < minDist) {
      minDist = dist;
      closestNode = id;
    }
  }

  return closestNode;
}

export interface TurnPenaltyConfig {
  straight: number;      // 0-100, default 0
  rightTurn: number;     // 0-200, default 10
  leftTurn: number;      // 0-500, default 50
  uTurn: number;         // 0-1000, default 500
}

/**
 * Calculate turn score with configurable penalties
 * Lower score = preferred turn
 * 
 * Turn categories:
 * - Straight (0°): score 0 + straightPenalty
 * - Slight right (1-45°): score 20 + rightTurnPenalty
 * - Right (46-90°): score 65 + rightTurnPenalty
 * - Sharp right (91-135°): score 110 + rightTurnPenalty
 * - Slight left (-1 to -45°): score 160 + leftTurnPenalty
 * - Left (-46 to -90°): score 205 + leftTurnPenalty
 * - Sharp left (-91 to -135°): score 250 + leftTurnPenalty
 * - U-turn (±136-180°): score 500+ + uTurnPenalty (heavy penalty)
 */
function calculateTurnScore(incomingBearing: number, outgoingBearing: number, penalties: TurnPenaltyConfig): number {
  // Calculate turn angle: positive = right, negative = left
  let turnAngle = outgoingBearing - incomingBearing;
  
  // Normalize to -180 to 180 range
  while (turnAngle > 180) turnAngle -= 360;
  while (turnAngle < -180) turnAngle += 360;
  
  const absTurn = Math.abs(turnAngle);
  
  // U-turn detection: turns greater than 150 degrees get heavy penalty
  if (absTurn > 150) {
    // U-turn penalty: base 500 + how close to 180 degrees + configurable penalty
    return 500 + (absTurn - 150) + penalties.uTurn;
  }
  
  // Prefer going straight or slight turns
  if (absTurn <= 20) {
    // Straight ahead: best score + configurable penalty
    return absTurn + penalties.straight;
  }
  
  // Right turns preferred over left turns
  if (turnAngle > 0) {
    // Right turn: score based on angle magnitude + configurable penalty
    return 20 + turnAngle + penalties.rightTurn;
  } else {
    // Left turn: add 140 penalty to prefer rights + configurable penalty
    return 160 + absTurn + penalties.leftTurn;
  }
}

function hierholzerWithTurnPreference(
  graph: Graph, 
  startNode: number,
  penalties: TurnPenaltyConfig
): number[] {
  // Create working copy of edges
  const remainingEdges = new Map<number, Array<{ to: number; key: number; data: GraphEdge }>>();
  const adjEntries = Array.from(graph.adjacency.entries());
  for (const [node, edges] of adjEntries) {
    remainingEdges.set(node, [...edges]);
  }

  const circuit: number[] = [];
  const stack: Array<{ node: number; incomingBearing: number | null }> = [
    { node: startNode, incomingBearing: null }
  ];

  while (stack.length > 0) {
    const { node, incomingBearing } = stack[stack.length - 1];
    const edges = remainingEdges.get(node) || [];

    if (edges.length > 0) {
      let selectedEdge: { to: number; key: number; data: GraphEdge };

      if (incomingBearing !== null && edges.length > 1) {
        // Score each edge by turn preference with configurable penalties
        const edgesWithScore = edges.map(edge => {
          const score = calculateTurnScore(incomingBearing, edge.data.bearing, penalties);
          return { edge, score };
        });
        
        // Sort by score (lower = better)
        edgesWithScore.sort((a, b) => a.score - b.score);
        selectedEdge = edgesWithScore[0].edge;
      } else {
        // No incoming bearing or only one choice - just take first available
        selectedEdge = edges[0];
      }

      // Remove selected edge
      const idx = edges.findIndex(e => e.key === selectedEdge.key);
      if (idx !== -1) edges.splice(idx, 1);

      stack.push({ 
        node: selectedEdge.to, 
        incomingBearing: selectedEdge.data.bearing 
      });
    } else {
      circuit.push(stack.pop()!.node);
    }
  }

  circuit.reverse();
  return circuit;
}

function generateGPX(
  circuit: number[], 
  nodes: Map<number, OSMNode>,
  filename: string
): string {
  const points = circuit
    .map(nodeId => nodes.get(nodeId))
    .filter((node): node is OSMNode => node !== undefined);

  const timestamp = new Date().toISOString();

  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="Trash Collection Route Planner">
  <metadata>
    <name>${filename}</name>
    <desc>Trash collection route generated using Chinese Postman Problem algorithm</desc>
    <time>${timestamp}</time>
  </metadata>
  <trk>
    <name>Trash Collection Route</name>
    <desc>Generated on ${new Date().toLocaleString()}</desc>
    <trkseg>
`;

  for (const point of points) {
    gpx += `      <trkpt lat="${point.lat}" lon="${point.lon}"></trkpt>\n`;
  }

  gpx += `    </trkseg>
  </trk>
</gpx>`;

  return gpx;
}

function calculateRouteStats(
  circuit: number[],
  graph: Graph,
  includedWays: number,
  excludedWays: number,
  componentCount: number
): RouteStats {
  let totalDistance = 0;
  let traversals = 0;
  let uTurnCount = 0;
  let rightTurnCount = 0;
  let leftTurnCount = 0;
  let prevBearing: number | null = null;
  let lastCountedBearing: number | null = null;

  for (let i = 0; i < circuit.length - 1; i++) {
    const u = circuit[i];
    const v = circuit[i + 1];
    const edges = graph.adjacency.get(u) || [];
    const edge = edges.find(e => e.to === v);
    if (edge) {
      totalDistance += edge.data.length;
      traversals++;
      
      // Count turn types only when bearing actually changes (at intersections)
      if (lastCountedBearing !== null && edge.data.bearing !== prevBearing) {
        let turnAngle = edge.data.bearing - lastCountedBearing;
        while (turnAngle > 180) turnAngle -= 360;
        while (turnAngle < -180) turnAngle += 360;
        
        const absTurn = Math.abs(turnAngle);
        
        if (absTurn > 150) {
          uTurnCount++;
        } else if (turnAngle > 20) {
          rightTurnCount++;
        } else if (turnAngle < -20) {
          leftTurnCount++;
        }
        // Straight ahead (within ±20°) not counted as a turn
      }
      
      // Update bearings: only count bearing change for turn statistics
      if (prevBearing !== null && edge.data.bearing !== prevBearing) {
        lastCountedBearing = prevBearing;
      }
      prevBearing = edge.data.bearing;
    }
  }

  const totalDistanceKm = totalDistance / 1000;
  const driveTimeMin = (totalDistanceKm / 15) * 60; // 15 km/h average speed

  return {
    totalDistanceKm,
    totalTraversals: traversals,
    driveTimeMin,
    nodeCount: graph.nodes.size,
    edgeCount: graph.edgeCount,
    connectedComponents: componentCount,
    includedWays,
    excludedWays,
    uTurnCount,
    rightTurnCount,
    leftTurnCount
  };
}

export interface StartPoint {
  lat: number;
  lon: number;
}

export async function processRoute(
  osmContent: string,
  filename: string,
  ignoreOneways: boolean,
  onLog: (log: ProcessingLog) => void,
  customStartPoint?: StartPoint | null,
  penalties?: TurnPenaltyConfig
): Promise<RouteResult> {
  // Use default penalties if not provided
  const activePenalties: TurnPenaltyConfig = penalties || {
    straight: 0,
    rightTurn: 10,
    leftTurn: 50,
    uTurn: 500,
  };
  const logs: ProcessingLog[] = [];
  const log = (message: string, type: ProcessingLog['type'] = 'info') => {
    const entry = createLog(message, type);
    logs.push(entry);
    onLog(entry);
  };

  log('Starting route generation...', 'info');
  log('Parsing OSM file...', 'info');

  // Parse OSM
  const { nodes, ways } = parseOSMFile(osmContent);
  log(`Parsed ${nodes.size} nodes and ${ways.length} ways`, 'success');

  // Filter ways
  log('Filtering road segments...', 'info');
  const { included, excluded } = filterWays(ways);
  log(`Included ${included.length} ways, excluded ${excluded.length} ways`, 'info');

  if (included.length === 0) {
    throw new Error('No valid road segments found in the OSM file');
  }

  // Build graph
  log('Building road network graph...', 'info');
  const graph = buildGraph(nodes, included, ignoreOneways);
  log(`Graph built with ${graph.nodes.size} nodes and ${graph.edgeCount} edges`, 'success');

  // Find largest SCC
  log('Analyzing network connectivity...', 'info');
  const { subgraph, componentCount } = findLargestSCC(graph);
  log(`Found ${componentCount} connected components`, 'info');
  log(`Largest component: ${subgraph.nodes.size} nodes, ${subgraph.edgeCount} edges`, 'success');

  if (subgraph.nodes.size === 0) {
    throw new Error('No connected road network found');
  }

  // Find start node
  let startNode: number;
  if (customStartPoint) {
    log(`Using custom start point: (${customStartPoint.lat.toFixed(6)}, ${customStartPoint.lon.toFixed(6)})`, 'info');
    startNode = findClosestNode(subgraph, customStartPoint.lat, customStartPoint.lon);
    const startCoord = subgraph.nodes.get(startNode);
    if (startCoord) {
      log(`Nearest graph node: (${startCoord.lat.toFixed(6)}, ${startCoord.lon.toFixed(6)})`, 'success');
    }
  } else {
    log('Calculating route start point (graph centroid)...', 'info');
    startNode = findCentroidNode(subgraph);
    const startCoord = subgraph.nodes.get(startNode);
    if (startCoord) {
      log(`Start point: (${startCoord.lat.toFixed(6)}, ${startCoord.lon.toFixed(6)})`, 'success');
    }
  }

  // Find Eulerian circuit
  log('Computing optimal route using Hierholzer algorithm...', 'info');
  log('Applying turn penalties for route optimization...', 'info');
  log(`Turn penalties - Right: ${activePenalties.rightTurn}, Left: ${activePenalties.leftTurn}, U-turn: ${activePenalties.uTurn}`, 'info');
  const circuit = hierholzerWithTurnPreference(subgraph, startNode, activePenalties);
  log(`Route computed: ${circuit.length} waypoints`, 'success');

  // Generate GPX
  log('Generating GPX file...', 'info');
  const gpxContent = generateGPX(circuit, subgraph.nodes, filename);
  log('GPX file generated successfully', 'success');

  // Calculate stats
  const stats = calculateRouteStats(
    circuit, 
    subgraph, 
    included.length, 
    excluded.length, 
    componentCount
  );

  log(`Total distance: ${stats.totalDistanceKm.toFixed(2)} km`, 'info');
  log(`Estimated drive time: ${stats.driveTimeMin.toFixed(1)} minutes (at 15 km/h)`, 'info');
  log(`Turn statistics: ${stats.rightTurnCount} right, ${stats.leftTurnCount} left, ${stats.uTurnCount} U-turns`, 'info');
  if (stats.uTurnCount > 0) {
    log(`Note: ${stats.uTurnCount} U-turns were unavoidable due to network topology`, 'warning');
  } else {
    log('No U-turns in the route!', 'success');
  }
  log('Route generation complete!', 'success');

  // Extract coordinates for map display
  const coordinates = circuit
    .map(nodeId => subgraph.nodes.get(nodeId))
    .filter((node): node is OSMNode => node !== undefined)
    .map(node => ({ lat: node.lat, lon: node.lon }));

  // Calculate bounds
  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;
  for (const coord of coordinates) {
    minLat = Math.min(minLat, coord.lat);
    maxLat = Math.max(maxLat, coord.lat);
    minLon = Math.min(minLon, coord.lon);
    maxLon = Math.max(maxLon, coord.lon);
  }

  return {
    gpxContent,
    stats,
    logs,
    coordinates,
    bounds: { minLat, maxLat, minLon, maxLon }
  };
}

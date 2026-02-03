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
  coordinates: Array<[number, number]>;
  gpxContent: string;
  stats: RouteStats;
}

export interface TurnPenaltyConfig {
  straight: number;
  rightTurn: number;
  leftTurn: number;
  uTurn: number;
}

// Highway types to INCLUDE (trash collection eligible)
const INCLUDE_HIGHWAYS = new Set([
  'residential',
  'unclassified',
  'service',
  'tertiary',
  'secondary'
]);

// Service types to EXCLUDE
const EXCLUDE_SERVICE = new Set(['parking_aisle', 'driveway']);

// Access types to EXCLUDE
const EXCLUDE_ACCESS = new Set(['private', 'no']);

// Highway types to EXCLUDE
const EXCLUDE_HIGHWAYS = new Set([
  'parking_aisle',
  'private',
  'footway',
  'cycleway',
  'steps',
  'path'
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
    const service = way.tags.service || '';
    const access = way.tags.access || '';
    
    // STEP 1: Check exclusion criteria first
    // Exclude by service type (parking_aisle, driveway)
    if (EXCLUDE_SERVICE.has(service)) {
      excluded.push(way);
      continue;
    }
    
    // Exclude by access type (private, no)
    if (EXCLUDE_ACCESS.has(access)) {
      excluded.push(way);
      continue;
    }
    
    // Exclude by highway type (parking_aisle, private, footway, cycleway, steps, path)
    if (EXCLUDE_HIGHWAYS.has(highway)) {
      excluded.push(way);
      continue;
    }
    
    // STEP 2: Check if highway is in the INCLUDE list
    // Only include: residential, unclassified, service, tertiary, secondary
    if (INCLUDE_HIGHWAYS.has(highway)) {
      included.push(way);
      continue;
    }
    
    // If highway is not in include list and not explicitly excluded, exclude it
    excluded.push(way);
  }

  return { included, excluded };
}

interface Graph {
  adjacency: Map<number, Array<{ to: number; key: number; data: GraphEdge }>>;
  nodes: Map<number, OSMNode>;
  edgeCount: number;
}

function buildGraph(
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

  for (const node of finished.reverse()) {
    if (!visited.has(node)) {
      const component = new Set<number>();
      dfs2(node, component);
      components.push(component);
    }
  }

  // Find largest component
  let largestComponent = components[0] || new Set();
  for (const component of components) {
    if (component.size > largestComponent.size) {
      largestComponent = component;
    }
  }

  // Build subgraph
  const subgraphAdj = new Map<number, Array<{ to: number; key: number; data: GraphEdge }>>();
  let edgeCount = 0;
  for (const [from, edges] of graph.adjacency.entries()) {
    if (largestComponent.has(from)) {
      const filteredEdges = edges.filter(e => largestComponent.has(e.to));
      if (filteredEdges.length > 0) {
        subgraphAdj.set(from, filteredEdges);
        edgeCount += filteredEdges.length;
      }
    }
  }

  const subgraphNodes = new Map<number, OSMNode>();
  for (const node of largestComponent) {
    const n = graph.nodes.get(node);
    if (n) subgraphNodes.set(node, n);
  }

  return {
    subgraph: { adjacency: subgraphAdj, nodes: subgraphNodes, edgeCount },
    componentCount: components.length
  };
}

function getOddDegreeNodes(graph: Graph): number[] {
  const degrees = new Map<number, number>();

  for (const [node, edges] of graph.adjacency.entries()) {
    degrees.set(node, (degrees.get(node) || 0) + edges.length);
  }

  for (const node of graph.nodes.keys()) {
    if (!degrees.has(node)) {
      degrees.set(node, 0);
    }
  }

  return Array.from(degrees.entries())
    .filter(([_, degree]) => degree % 2 === 1)
    .map(([node, _]) => node);
}

function dijkstra(
  graph: Graph,
  start: number,
  end: number
): { path: number[]; distance: number } {
  const distances = new Map<number, number>();
  const previous = new Map<number, number>();
  const unvisited = new Set(graph.nodes.keys());

  for (const node of graph.nodes.keys()) {
    distances.set(node, Infinity);
  }
  distances.set(start, 0);

  while (unvisited.size > 0) {
    let current = -1;
    let minDistance = Infinity;

    for (const node of unvisited) {
      const dist = distances.get(node) || Infinity;
      if (dist < minDistance) {
        minDistance = dist;
        current = node;
      }
    }

    if (current === -1 || current === end) break;
    unvisited.delete(current);

    const edges = graph.adjacency.get(current) || [];
    for (const edge of edges) {
      if (unvisited.has(edge.to)) {
        const newDist = (distances.get(current) || Infinity) + edge.data.length;
        if (newDist < (distances.get(edge.to) || Infinity)) {
          distances.set(edge.to, newDist);
          previous.set(edge.to, current);
        }
      }
    }
  }

  const path: number[] = [];
  let current = end;
  while (previous.has(current)) {
    path.unshift(current);
    current = previous.get(current)!;
  }
  path.unshift(start);

  return {
    path,
    distance: distances.get(end) || Infinity
  };
}

function minimumWeightMatching(graph: Graph, oddNodes: number[]): Array<[number, number]> {
  const matching: Array<[number, number]> = [];
  const matched = new Set<number>();

  for (let i = 0; i < oddNodes.length; i++) {
    if (matched.has(oddNodes[i])) continue;

    let bestJ = -1;
    let bestDistance = Infinity;

    for (let j = i + 1; j < oddNodes.length; j++) {
      if (matched.has(oddNodes[j])) continue;

      const { distance } = dijkstra(graph, oddNodes[i], oddNodes[j]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestJ = j;
      }
    }

    if (bestJ !== -1) {
      matching.push([oddNodes[i], oddNodes[bestJ]]);
      matched.add(oddNodes[i]);
      matched.add(oddNodes[bestJ]);
    }
  }

  return matching;
}

function createMultigraph(graph: Graph, matching: Array<[number, number]>): Graph {
  const multigraph = new Map<number, Array<{ to: number; key: number; data: GraphEdge }>>();
  let edgeKey = 0;

  // Copy original edges
  for (const [from, edges] of graph.adjacency.entries()) {
    const edgesCopy = [];
    for (const edge of edges) {
      edgesCopy.push({ ...edge, key: edgeKey++ });
    }
    multigraph.set(from, edgesCopy);
  }

  // Add matching edges
  for (const [u, v] of matching) {
    const { path } = dijkstra(graph, u, v);

    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];

      const edges = graph.adjacency.get(from) || [];
      const edge = edges.find(e => e.to === to);

      if (edge) {
        if (!multigraph.has(from)) multigraph.set(from, []);
        multigraph.get(from)!.push({
          to,
          key: edgeKey++,
          data: edge.data
        });
      }
    }
  }

  return {
    adjacency: multigraph,
    nodes: graph.nodes,
    edgeCount: edgeKey
  };
}

function findEulerianCircuit(graph: Graph, startNode: number): number[] {
  const stack: number[] = [startNode];
  const circuit: number[] = [];
  const edges = new Map<string, Array<{ to: number; key: number; data: GraphEdge }>>();

  // Deep copy adjacency list
  for (const [node, edgeList] of graph.adjacency.entries()) {
    edges.set(node.toString(), [...edgeList]);
  }

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const currentEdges = edges.get(current.toString()) || [];

    if (currentEdges.length > 0) {
      const edge = currentEdges.pop()!;
      stack.push(edge.to);
    } else {
      circuit.push(stack.pop()!);
    }
  }

  return circuit.reverse();
}

function getCircuitCoordinates(circuit: number[], nodes: Map<number, OSMNode>): Array<[number, number]> {
  return circuit
    .map(nodeId => nodes.get(nodeId))
    .filter((node): node is OSMNode => node !== undefined)
    .map(node => [node.lat, node.lon] as [number, number]);
}

function generateGPX(filename: string, points: Array<[number, number]>): string {
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
    gpx += `      <trkpt lat="${point[0]}" lon="${point[1]}"></trkpt>\n`;
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

function findNearestNode(graph: Graph, startPoint: StartPoint): number {
  let nearestNode = -1;
  let minDistance = Infinity;

  for (const [nodeId, node] of graph.nodes.entries()) {
    const distance = haversineDistance(startPoint.lat, startPoint.lon, node.lat, node.lon);
    if (distance < minDistance) {
      minDistance = distance;
      nearestNode = nodeId;
    }
  }

  return nearestNode;
}

export async function processRoute(
  osmContent: string,
  filename: string,
  ignoreOneways: boolean,
  onLog?: (log: ProcessingLog) => void,
  startPoint?: StartPoint,
  penalties?: TurnPenaltyConfig
): Promise<RouteResult> {
  const logs: ProcessingLog[] = [];

  function log(message: string, type: ProcessingLog['type'] = 'info') {
    const logEntry = createLog(message, type);
    logs.push(logEntry);
    onLog?.(logEntry);
  }

  log('Parsing OSM file...', 'info');
  const { nodes, ways } = parseOSMFile(osmContent);
  log(`Found ${nodes.size} nodes and ${ways.length} ways`, 'info');

  log('Filtering ways...', 'info');
  const { included, excluded } = filterWays(ways);
  log(`Included ${included.length} ways, excluded ${excluded.length} ways`, 'success');

  log('Building graph...', 'info');
  let graph = buildGraph(nodes, included, ignoreOneways);
  log(`Graph has ${graph.nodes.size} nodes and ${graph.edgeCount} edges`, 'info');

  log('Finding largest connected component...', 'info');
  const { subgraph, componentCount } = findLargestSCC(graph);
  log(`Found ${componentCount} components, largest has ${subgraph.nodes.size} nodes`, 'info');
  graph = subgraph;

  log('Finding odd-degree nodes...', 'info');
  const oddNodes = getOddDegreeNodes(graph);
  log(`Found ${oddNodes.length} odd-degree nodes`, 'info');

  log('Computing minimum weight matching...', 'info');
  const matching = minimumWeightMatching(graph, oddNodes);
  log(`Computed matching with ${matching.length} pairs`, 'info');

  log('Creating Eulerian multigraph...', 'info');
  const multigraph = createMultigraph(graph, matching);
  log(`Multigraph has ${multigraph.edgeCount} edges`, 'info');

  let startNode = Array.from(multigraph.nodes.keys())[0];
  if (startPoint) {
    log(`Finding nearest node to start point (${startPoint.lat}, ${startPoint.lon})...`, 'info');
    startNode = findNearestNode(multigraph, startPoint);
    const node = multigraph.nodes.get(startNode);
    if (node) {
      log(`Starting from node ${startNode} at (${node.lat}, ${node.lon})`, 'success');
    }
  }

  log('Finding Eulerian circuit...', 'info');
  const circuit = findEulerianCircuit(multigraph, startNode);
  log(`Circuit has ${circuit.length} nodes`, 'success');

  log('Generating coordinates...', 'info');
  const coordinates = getCircuitCoordinates(circuit, multigraph.nodes);
  log(`Generated ${coordinates.length} coordinate points`, 'success');

  log('Generating GPX file...', 'info');
  const gpxContent = generateGPX(filename, coordinates);
  log('GPX file generated', 'success');

  log('Calculating statistics...', 'info');
  const stats = calculateRouteStats(circuit, multigraph, included.length, excluded.length, componentCount);
  log('Statistics calculated', 'success');

  log('Route generation complete!', 'success');

  return {
    coordinates,
    gpxContent,
    stats
  };
}

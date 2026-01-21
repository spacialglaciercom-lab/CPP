/**
 * U-Turn Detection Module
 * Parses OSM XML to identify:
 * 1. Restriction relations (no_u_turn, u_turn)
 * 2. Turning circles/loops (junction=turning_circle, junction=turning_loop)
 */

export interface UTurnRestriction {
  id: string;
  type: 'no_u_turn' | 'u_turn';
  streetNames: string[];
  nodeReferences: string[];
  coordinates: Array<{ lat: number; lon: number }>;
  memberWayIds: string[];
}

export interface TurningFeature {
  id: string;
  type: 'turning_circle' | 'turning_loop';
  name?: string;
  nodeReferences: string[];
  coordinates: Array<{ lat: number; lon: number }>;
}

export interface UTurnDetectionResult {
  restrictionCount: number;
  turningFeatureCount: number;
  totalCount: number;
  restrictions: UTurnRestriction[];
  turningFeatures: TurningFeature[];
  summary: {
    noUTurnCount: number;
    allowUTurnCount: number;
    turningCircleCount: number;
    turningLoopCount: number;
  };
}

/**
 * Parse OSM XML and detect U-turn related features
 */
export function detectUTurns(osmContent: string): UTurnDetectionResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(osmContent, 'text/xml');

  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Failed to parse OSM XML');
  }

  const restrictions: UTurnRestriction[] = [];
  const turningFeatures: TurningFeature[] = [];

  // Create a map of node ID to coordinates for quick lookup
  const nodeCoordinates = new Map<string, { lat: number; lon: number }>();
  const nodeElements = doc.getElementsByTagName('node');
  for (let i = 0; i < nodeElements.length; i++) {
    const node = nodeElements[i];
    const id = node.getAttribute('id');
    const lat = parseFloat(node.getAttribute('lat') || '0');
    const lon = parseFloat(node.getAttribute('lon') || '0');
    if (id) {
      nodeCoordinates.set(id, { lat, lon });
    }
  }

  // Create a map of way ID to way element for quick lookup
  const wayMap = new Map<string, Element>();
  const wayElements = doc.getElementsByTagName('way');
  for (let i = 0; i < wayElements.length; i++) {
    const way = wayElements[i];
    const id = way.getAttribute('id');
    if (id) {
      wayMap.set(id, way);
    }
  }

  // Parse relations for U-turn restrictions
  const relationElements = doc.getElementsByTagName('relation');
  for (let i = 0; i < relationElements.length; i++) {
    const relation = relationElements[i];
    const relationId = relation.getAttribute('id') || '';

    // Check for restriction tags
    const restrictionTag = relation.querySelector('tag[k="restriction"]');
    if (restrictionTag) {
      const restrictionValue = restrictionTag.getAttribute('v');
      if (restrictionValue === 'no_u_turn' || restrictionValue === 'u_turn') {
        const restriction = parseRestrictionRelation(
          relation,
          relationId,
          restrictionValue as 'no_u_turn' | 'u_turn',
          nodeCoordinates,
          wayMap
        );
        if (restriction) {
          restrictions.push(restriction);
        }
      }
    }
  }

  // Parse ways for turning circles/loops
  for (let i = 0; i < wayElements.length; i++) {
    const way = wayElements[i];
    const wayId = way.getAttribute('id') || '';

    // Check for junction tags
    const junctionTag = way.querySelector('tag[k="junction"]');
    if (junctionTag) {
      const junctionValue = junctionTag.getAttribute('v');
      if (junctionValue === 'turning_circle' || junctionValue === 'turning_loop') {
        const feature = parseTurningFeature(
          way,
          wayId,
          junctionValue as 'turning_circle' | 'turning_loop',
          nodeCoordinates
        );
        if (feature) {
          turningFeatures.push(feature);
        }
      }
    }
  }

  // Calculate summary
  const summary = {
    noUTurnCount: restrictions.filter(r => r.type === 'no_u_turn').length,
    allowUTurnCount: restrictions.filter(r => r.type === 'u_turn').length,
    turningCircleCount: turningFeatures.filter(f => f.type === 'turning_circle').length,
    turningLoopCount: turningFeatures.filter(f => f.type === 'turning_loop').length,
  };

  return {
    restrictionCount: restrictions.length,
    turningFeatureCount: turningFeatures.length,
    totalCount: restrictions.length + turningFeatures.length,
    restrictions,
    turningFeatures,
    summary,
  };
}

/**
 * Parse a restriction relation to extract U-turn information
 */
function parseRestrictionRelation(
  relation: Element,
  relationId: string,
  type: 'no_u_turn' | 'u_turn',
  nodeCoordinates: Map<string, { lat: number; lon: number }>,
  wayMap: Map<string, Element>
): UTurnRestriction | null {
  const streetNames: string[] = [];
  const nodeReferences: string[] = [];
  const coordinates: Array<{ lat: number; lon: number }> = [];
  const memberWayIds: string[] = [];

  // Extract member ways and their names
  const memberElements = relation.getElementsByTagName('member');
  for (let i = 0; i < memberElements.length; i++) {
    const member = memberElements[i];
    const memberType = member.getAttribute('type');
    const memberRef = member.getAttribute('ref');
    const memberRole = member.getAttribute('role');

    if (memberType === 'way' && memberRef) {
      memberWayIds.push(memberRef);
      const way = wayMap.get(memberRef);
      if (way) {
        // Extract street name
        const nameTag = way.querySelector('tag[k="name"]');
        if (nameTag) {
          const name = nameTag.getAttribute('v');
          if (name && !streetNames.includes(name)) {
            streetNames.push(name);
          }
        }

        // Extract node references from the way
        const ndElements = way.getElementsByTagName('nd');
        for (let j = 0; j < ndElements.length; j++) {
          const nd = ndElements[j];
          const nodeRef = nd.getAttribute('ref');
          if (nodeRef && !nodeReferences.includes(nodeRef)) {
            nodeReferences.push(nodeRef);
            // Get coordinates if available
            const coord = nodeCoordinates.get(nodeRef);
            if (coord) {
              coordinates.push(coord);
            }
          }
        }
      }
    } else if (memberType === 'node' && memberRef) {
      nodeReferences.push(memberRef);
      const coord = nodeCoordinates.get(memberRef);
      if (coord) {
        coordinates.push(coord);
      }
    }
  }

  if (streetNames.length === 0 && nodeReferences.length === 0) {
    return null;
  }

  return {
    id: relationId,
    type,
    streetNames,
    nodeReferences,
    coordinates,
    memberWayIds,
  };
}

/**
 * Parse a turning feature (circle/loop) from a way
 */
function parseTurningFeature(
  way: Element,
  wayId: string,
  type: 'turning_circle' | 'turning_loop',
  nodeCoordinates: Map<string, { lat: number; lon: number }>
): TurningFeature | null {
  const nodeReferences: string[] = [];
  const coordinates: Array<{ lat: number; lon: number }> = [];

  // Extract node references
  const ndElements = way.getElementsByTagName('nd');
  for (let i = 0; i < ndElements.length; i++) {
    const nd = ndElements[i];
    const nodeRef = nd.getAttribute('ref');
    if (nodeRef) {
      nodeReferences.push(nodeRef);
      const coord = nodeCoordinates.get(nodeRef);
      if (coord) {
        coordinates.push(coord);
      }
    }
  }

  // Extract name if available
  const nameTag = way.querySelector('tag[k="name"]');
  const name = nameTag ? nameTag.getAttribute('v') || undefined : undefined;

  if (nodeReferences.length === 0) {
    return null;
  }

  return {
    id: wayId,
    type,
    name,
    nodeReferences,
    coordinates,
  };
}

/**
 * Export U-turn detection results as JSON
 */
export function exportUTurnDetectionJSON(result: UTurnDetectionResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Export U-turn detection results as CSV
 */
export function exportUTurnDetectionCSV(result: UTurnDetectionResult): string {
  let csv = 'Feature Type,ID,Street Names,Node Count,Coordinates\n';

  // Add restrictions
  for (const restriction of result.restrictions) {
    const streetNamesStr = restriction.streetNames.join('; ') || 'N/A';
    const coordStr = restriction.coordinates
      .map(c => `(${c.lat.toFixed(6)},${c.lon.toFixed(6)})`)
      .join('; ');
    csv += `"${restriction.type}","${restriction.id}","${streetNamesStr}",${restriction.nodeReferences.length},"${coordStr}"\n`;
  }

  // Add turning features
  for (const feature of result.turningFeatures) {
    const nameStr = feature.name || 'N/A';
    const coordStr = feature.coordinates
      .map(c => `(${c.lat.toFixed(6)},${c.lon.toFixed(6)})`)
      .join('; ');
    csv += `"${feature.type}","${feature.id}","${nameStr}",${feature.nodeReferences.length},"${coordStr}"\n`;
  }

  return csv;
}

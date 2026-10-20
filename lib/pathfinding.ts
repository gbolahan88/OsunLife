export type GridNode = { col: number; row: number };

export type PathfindingGrid = {
  cols: number;
  rows: number;
  /** true = walkable, false = blocked */
  walkable: boolean[][];
};

/**
 * Find a path from start to goal using A*.
 * Returns an array of nodes including start and goal (excluding start is fine too).
 * Returns null if no path exists.
 */
export function findPath(
  grid: PathfindingGrid,
  start: GridNode,
  goal: GridNode,
): GridNode[] | null {
  const { cols, rows, walkable } = grid;

  if (!isInside(cols, rows, start) || !isInside(cols, rows, goal)) return null;
  if (!walkable[goal.row][goal.col]) return null;

  const startKey = keyOf(start);
  const goalKey = keyOf(goal);
  if (startKey === goalKey) return [start];

  const openSet = new Set<string>([startKey]);
  const cameFrom = new Map<string, string>();

  const gScore = new Map<string, number>();
  gScore.set(startKey, 0);

  const fScore = new Map<string, number>();
  fScore.set(startKey, heuristic(start, goal));

  while (openSet.size > 0) {
    // Find the node in openSet with the lowest fScore
    let currentKey = "";
    let lowestF = Infinity;
    for (const k of openSet) {
      const f = fScore.get(k) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        currentKey = k;
      }
    }

    if (!currentKey) return null;
    if (currentKey === goalKey) return reconstruct(cameFrom, currentKey, start, goal);

    openSet.delete(currentKey);
    const current = parseKey(currentKey);

    for (const neighbor of neighbors(current, cols, rows)) {
      if (!walkable[neighbor.row][neighbor.col]) continue;

      const neighborKey = keyOf(neighbor);
      const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1;

      if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
        cameFrom.set(neighborKey, currentKey);
        gScore.set(neighborKey, tentativeG);
        fScore.set(neighborKey, tentativeG + heuristic(neighbor, goal));
        openSet.add(neighborKey);
      }
    }
  }

  return null;
}

function isInside(cols: number, rows: number, node: GridNode): boolean {
  return node.col >= 0 && node.col < cols && node.row >= 0 && node.row < rows;
}

function keyOf(node: GridNode): string {
  return `${node.col},${node.row}`;
}

function parseKey(key: string): GridNode {
  const [col, row] = key.split(",").map(Number);
  return { col, row };
}

function heuristic(a: GridNode, b: GridNode): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function neighbors(node: GridNode, cols: number, rows: number): GridNode[] {
  const result: GridNode[] = [];
  const dirs = [
    { dc: 1, dr: 0 },
    { dc: -1, dr: 0 },
    { dc: 0, dr: 1 },
    { dc: 0, dr: -1 },
  ];
  for (const { dc, dr } of dirs) {
    const col = node.col + dc;
    const row = node.row + dr;
    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      result.push({ col, row });
    }
  }
  return result;
}

function reconstruct(
  cameFrom: Map<string, string>,
  goalKey: string,
  start: GridNode,
  goal: GridNode,
): GridNode[] {
  const path: GridNode[] = [goal];
  let currentKey = goalKey;
  while (cameFrom.has(currentKey)) {
    currentKey = cameFrom.get(currentKey)!;
    path.push(parseKey(currentKey));
  }
  path.reverse();
  return path;
}
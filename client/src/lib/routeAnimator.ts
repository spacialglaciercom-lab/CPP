/**
 * Route Animation System
 * Animates truck movement along the route with progress tracking
 * Blue lines turn red as the truck passes them
 */

export interface AnimationState {
  isPlaying: boolean;
  progress: number;
  currentWaypointIndex: number;
  completedEdges: Set<number>;
  truckLat: number;
  truckLon: number;
  speed: number;
}

export interface RouteCoordinate {
  lat: number;
  lon: number;
  edgeKey?: number;
}

export class RouteAnimator {
  private coordinates: RouteCoordinate[] = [];
  private animationState: AnimationState;
  private animationFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private onProgressUpdate: ((state: AnimationState) => void) | null = null;
  private onEdgeComplete: ((edgeKey: number) => void) | null = null;

  constructor(coordinates: RouteCoordinate[], speed: number = 1.0) {
    this.coordinates = coordinates;
    this.animationState = {
      isPlaying: false,
      progress: 0,
      currentWaypointIndex: 0,
      completedEdges: new Set(),
      truckLat: coordinates[0]?.lat || 0,
      truckLon: coordinates[0]?.lon || 0,
      speed,
    };
  }

  setOnProgressUpdate(callback: (state: AnimationState) => void) {
    this.onProgressUpdate = callback;
  }

  setOnEdgeComplete(callback: (edgeKey: number) => void) {
    this.onEdgeComplete = callback;
  }

  play() {
    if (this.animationState.isPlaying) return;
    this.animationState.isPlaying = true;
    this.lastTimestamp = performance.now();
    this.animate();
  }

  pause() {
    this.animationState.isPlaying = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  reset() {
    this.pause();
    this.animationState = {
      isPlaying: false,
      progress: 0,
      currentWaypointIndex: 0,
      completedEdges: new Set(),
      truckLat: this.coordinates[0]?.lat || 0,
      truckLon: this.coordinates[0]?.lon || 0,
      speed: this.animationState.speed,
    };
    this.onProgressUpdate?.(this.animationState);
  }

  setSpeed(speed: number) {
    this.animationState.speed = Math.max(0.1, Math.min(5, speed));
  }

  private animate = () => {
    const now = performance.now();
    const deltaTime = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;

    if (!this.animationState.isPlaying || this.coordinates.length === 0) {
      return;
    }

    const waypointDistance = this.animationState.speed * deltaTime;
    const newIndex = this.animationState.currentWaypointIndex + waypointDistance;

    if (newIndex >= this.coordinates.length - 1) {
      this.animationState.currentWaypointIndex = this.coordinates.length - 1;
      this.animationState.progress = 1;
      const lastCoord = this.coordinates[this.coordinates.length - 1];
      this.animationState.truckLat = lastCoord.lat;
      this.animationState.truckLon = lastCoord.lon;
      this.onProgressUpdate?.(this.animationState);
      this.pause();
      return;
    }

    const currentIndex = Math.floor(newIndex);
    const nextIndex = Math.min(currentIndex + 1, this.coordinates.length - 1);
    const t = newIndex - currentIndex;

    const current = this.coordinates[currentIndex];
    const next = this.coordinates[nextIndex];

    this.animationState.truckLat = current.lat + (next.lat - current.lat) * t;
    this.animationState.truckLon = current.lon + (next.lon - current.lon) * t;
    this.animationState.currentWaypointIndex = newIndex;
    this.animationState.progress = newIndex / (this.coordinates.length - 1);

    const prevIndex = Math.floor(this.animationState.currentWaypointIndex - 1);
    if (prevIndex >= 0 && prevIndex < this.coordinates.length - 1) {
      const edgeKey = this.coordinates[prevIndex].edgeKey;
      if (edgeKey !== undefined && !this.animationState.completedEdges.has(edgeKey)) {
        this.animationState.completedEdges.add(edgeKey);
        this.onEdgeComplete?.(edgeKey);
      }
    }

    this.onProgressUpdate?.(this.animationState);
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  getState(): AnimationState {
    return { ...this.animationState };
  }

  getCompletedEdges(): Set<number> {
    return new Set(this.animationState.completedEdges);
  }
}

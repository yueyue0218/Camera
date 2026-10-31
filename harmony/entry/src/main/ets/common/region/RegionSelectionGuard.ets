/** Lifecycle guard shared by confirmation, location and manual selection callbacks. */
export class RegionSelectionGuard {
  generation: number = 0;
  private active: boolean = false;
  private identity: number = -1;
  appear(): void { this.active = true; }
  leave(): void { this.active = false; this.generation++; }
  invalidate(): void { this.generation++; }
  begin(identity: number): number { this.identity = identity; return ++this.generation; }
  accepts(generation: number, identity: number, routeVisible: boolean): boolean {
    return this.active && routeVisible && generation === this.generation && identity === this.identity;
  }
}

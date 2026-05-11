import { Injectable } from '@nestjs/common';

@Injectable()
export class GpsService {
  /**
   * Haversine distance in meters between two coordinates.
   */
  distance(latA: number, lngA: number, latB: number, lngB: number): number {
    const R = 6_371_000;
    const dLat = ((latB - latA) * Math.PI) / 180;
    const dLng = ((lngB - lngA) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((latA * Math.PI) / 180) *
        Math.cos((latB * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  isWithinRadius(
    studentLat: number,
    studentLng: number,
    roomLat: number,
    roomLng: number,
    radiusMeters: number,
  ): boolean {
    return this.distance(studentLat, studentLng, roomLat, roomLng) <= radiusMeters;
  }
}

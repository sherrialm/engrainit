/**
 * Ambience track registry
 *
 * Placeholder entries — actual MP3s can be dropped into /public/ambience/ later.
 */

export interface AmbienceTrack {
    id: string;
    label: string;
    file: string;
}

export const AMBIENCE_TRACKS: AmbienceTrack[] = [
    { id: 'pink-noise', label: 'Pink Noise', file: '/ambience/pink-noise.mp3' },
    { id: 'rain', label: 'Gentle Rain', file: '/ambience/rain.mp3' },
    { id: 'brown-noise', label: 'Brown Noise', file: '/ambience/brown-noise.mp3' },
    { id: 'soft-drone', label: 'Soft Drone', file: '/ambience/soft-drone.mp3' },
];

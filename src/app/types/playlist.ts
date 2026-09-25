/**
 * Shared playlist track shape. Structurally identical to the state declared
 * in App.tsx (`useState<Array<{ id, file, name, duration }>>`), so App can
 * pass its state and setter straight through without changes.
 */
export interface PlaylistTrack {
  id: string;
  file: File;
  name: string;
  duration: number;
}

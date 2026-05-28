export interface TrainPosition {
  rid: string;
  headcode: string | null;
  toc: string | null;
  lat: number;
  lng: number;
  fromTiploc: string | null;
  toTiploc: string | null;
  origin: string | null;
  destination: string | null;
  delayMinutes: number;
  heading: number | null;
  updatedAt: string;
}

export type WsMessage =
  | { type: "snapshot"; trains: TrainPosition[]; removes?: string[] }
  | { type: "update"; train: TrainPosition }
  | { type: "remove"; rid: string };

export interface Report {
  id: string;
  owner: string;
  timestamp: string | number; // or Date if you transform it before storing
  status: string;
  description?: string;
  additionalInfo?: string;
}

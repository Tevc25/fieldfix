export type ReportStatus = 'submitted' | 'in_review' | 'resolved' | 'rejected';

export type ReportCategory =
  | 'pothole'
  | 'broken_streetlight'
  | 'graffiti'
  | 'illegal_dumping'
  | 'damaged_sign'
  | 'other';

export interface Report {
  id: string;
  clientId: string;
  title: string;
  category: ReportCategory;
  description: string;
  lat: number;
  lng: number;
  address?: string;
  photoUrl?: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistoryEntry {
  id: string;
  reportId: string;
  status: ReportStatus;
  note?: string;
  changedAt: string;
}

export interface PushSubscriptionRecord {
  endpointHash: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
}

export interface CreateReportResponse {
  id: string;
  clientId: string;
  status: ReportStatus;
  createdAt: string;
}

export interface ReportDetail extends Report {
  statusHistory: StatusHistoryEntry[];
}

export interface PaginatedReports {
  data: Report[];
  total: number;
  page: number;
  pageSize: number;
}

export interface HealthResponse {
  status: 'ok';
  runtime: string;
  uptime: number;
}

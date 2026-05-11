import type {
  CreateReportResponse,
  PaginatedReports,
  ReportDetail,
  ReportStatus,
} from '@fieldfix/shared';

const BASE = '/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function checkResponse(res: Response): Promise<Response> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(res.status, message);
  }
  return res;
}

export async function createReport(formData: FormData): Promise<CreateReportResponse> {
  const res = await fetch(`${BASE}/reports`, { method: 'POST', body: formData });
  await checkResponse(res);
  return res.json() as Promise<CreateReportResponse>;
}

export interface ListParams {
  status?: ReportStatus;
  bbox?: string;
  page?: number;
  pageSize?: number;
}

export async function listReports(params: ListParams = {}): Promise<PaginatedReports> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.bbox) qs.set('bbox', params.bbox);
  if (params.page !== undefined) qs.set('page', String(params.page));
  if (params.pageSize !== undefined) qs.set('pageSize', String(params.pageSize));

  const url = `${BASE}/reports${qs.size > 0 ? `?${qs}` : ''}`;
  const res = await fetch(url);
  await checkResponse(res);
  return res.json() as Promise<PaginatedReports>;
}

export async function getReport(id: string): Promise<ReportDetail> {
  const res = await fetch(`${BASE}/reports/${encodeURIComponent(id)}`);
  await checkResponse(res);
  return res.json() as Promise<ReportDetail>;
}

export async function getVapidPublicKey(): Promise<string> {
  const res = await fetch(`${BASE}/vapid-public-key`);
  await checkResponse(res);
  const body = (await res.json()) as { publicKey: string };
  return body.publicKey;
}

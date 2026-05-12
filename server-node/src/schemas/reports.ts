import { z } from 'zod';
import type { ReportStatus } from '@fieldfix/shared';

export const ReportCategorySchema = z.enum([
  'pothole',
  'broken_streetlight',
  'graffiti',
  'illegal_dumping',
  'damaged_sign',
  'other',
]);

export const ReportStatusSchema = z.enum(['submitted', 'in_review', 'resolved', 'rejected']);

export const CreateReportFieldsSchema = z.object({
  clientId: z.string().uuid({ message: 'clientId musí být UUID v4' }),
  title: z.string().min(3).max(120),
  category: ReportCategorySchema,
  description: z.string().min(10).max(2000),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  address: z.string().max(255).optional(),
});

export const UpdateStatusSchema = z.object({
  status: ReportStatusSchema,
  note: z.string().max(500).optional(),
});

export const ListQuerySchema = z.object({
  status: ReportStatusSchema.optional(),
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(20),
});

// Valid status transitions: submitted→in_review, in_review→resolved|rejected
const ALLOWED_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  submitted: ['in_review'],
  in_review: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
};

export function isValidTransition(from: ReportStatus, to: ReportStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

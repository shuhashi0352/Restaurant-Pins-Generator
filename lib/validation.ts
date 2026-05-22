import { z } from "zod";

export const priceLevelSchema = z.enum(["any", "1", "2", "3", "4"]);
export const iconSchema = z.enum(["restaurant", "star", "heart", "flag", "pin"]);

export const generateMapSchema = z.object({
  center: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    label: z.string().min(1).max(180),
  }),
  radiusMeters: z.coerce.number().int().min(100).max(50000),
  minRating: z.union([z.literal("any"), z.coerce.number().min(0).max(5)]),
  minReviewCount: z.union([z.literal("any"), z.coerce.number().int().min(0).max(1000000)]),
  maxPins: z.coerce.number().int().min(1).max(60),
  name: z.string().min(1).max(100),
  priceLevel: priceLevelSchema,
  openNow: z.union([z.literal("any"), z.literal("open")]),
});

export const geocodeSchema = z.object({
  query: z.string().min(2).max(240),
});

export type GenerateMapInput = z.infer<typeof generateMapSchema>;

import { NextResponse } from "next/server";
import { geocodeLocation } from "@/lib/google/places";
import { geocodeSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = geocodeSchema.parse(await request.json());
    const location = await geocodeLocation(body.query);
    return NextResponse.json({ location });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not geocode that location." },
      { status: 400 },
    );
  }
}

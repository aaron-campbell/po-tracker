import { NextResponse } from "next/server";
import data from "@/data/commercial-status.json";

export async function GET() {
  return NextResponse.json(data);
}

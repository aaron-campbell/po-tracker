import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const url = request.nextUrl.searchParams.get("url");
    if (!url) {
      return new Response("Missing url parameter", { status: 400 });
    }

    // Only allow Slack file URLs
    if (!url.startsWith("https://files.slack.com/")) {
      return new Response("Invalid URL", { status: 400 });
    }

    const slackToken = process.env.SLACK_TOKEN;
    if (!slackToken) {
      return new Response("Slack token not configured", { status: 500 });
    }

    // Slack file URLs may redirect — follow manually so the auth header
    // is sent on the first request and dropped on cross-origin redirects.
    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${slackToken}` },
      redirect: "manual",
    });

    if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
      const location = res.headers.get("location");
      if (!location) return new Response("Redirect with no location", { status: 502 });
      res = await fetch(location);
    }

    if (!res.ok) {
      return new Response("Failed to fetch PDF from Slack", { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "application/pdf";
    const body = await res.arrayBuffer();

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return new Response("Unauthorized", { status: 401 });
    }
    return new Response("Internal server error", { status: 500 });
  }
}

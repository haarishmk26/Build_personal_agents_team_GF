import { NextRequest, NextResponse } from "next/server";
export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization)
    return NextResponse.json({ message: "Sign in required" }, { status: 401 });
  const body = await request.json();
  const upstream =
    process.env.NEXT_PUBLIC_API_URL ??
    "http://personal-agents-api.personal-agents-ns-1.svc.cluster.local:4000";
  const response = await fetch(`${upstream}/v1/plans/move`, {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await response.json(), { status: response.status });
}

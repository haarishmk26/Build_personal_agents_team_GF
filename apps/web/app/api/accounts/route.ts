import { NextRequest, NextResponse } from "next/server";
export async function GET(request: NextRequest) {
  const authorization=request.headers.get("authorization");
  if(!authorization) return NextResponse.json({message:"Sign in required"},{status:401});
  const upstream=process.env.NEXT_PUBLIC_API_URL ?? "http://personal-agents-api.personal-agents-ns-1.svc.cluster.local:4000";
  const response=await fetch(`${upstream}/v1/accounts`,{headers:{authorization},cache:"no-store"});
  return NextResponse.json(await response.json(),{status:response.status});
}
import guide from "../../../../docs/phone-access.md?raw";

export function GET() {
  return new Response(guide, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

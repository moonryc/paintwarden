import disclosure from "../../../../docs/privacy.md?raw";

// Generate from the source disclosure so private-release gates never hide it.
export function GET() {
  return new Response(disclosure, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

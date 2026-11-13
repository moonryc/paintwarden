import {
  createScheme,
  deleteScheme,
  SchemeCommandError,
  type SchemeInput,
  updateScheme,
} from "../../../lib/commands/schemes.ts";
import { serializeImageMutation } from "../../../lib/image-mutations";

function commandError(error: unknown): Response {
  if (error instanceof SchemeCommandError)
    return Response.json({ error: error.message }, { status: error.status });
  throw error;
}

export const POST = serializeImageMutation(async function POST(request: Request) {
  const body = (await request.json()) as SchemeInput;
  try {
    return Response.json(createScheme(body), { status: 201 });
  } catch (error) {
    return commandError(error);
  }
});

export const PUT = serializeImageMutation(async function PUT(request: Request) {
  const body = (await request.json()) as SchemeInput & { id?: string };
  try {
    updateScheme(body.id ?? "", body);
    return Response.json({ ok: true });
  } catch (error) {
    return commandError(error);
  }
});

export const DELETE = serializeImageMutation(async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  try {
    deleteScheme(id ?? "");
    return Response.json({ ok: true });
  } catch (error) {
    return commandError(error);
  }
});

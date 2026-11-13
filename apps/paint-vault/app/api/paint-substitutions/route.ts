import {
  createSubstitution,
  deleteSubstitution,
  updateSubstitution,
} from "../../../lib/commands/paint-substitutions.ts";
import { commandResponse } from "../../../lib/commands/paints.ts";

export async function POST(request: Request) {
  try {
    return Response.json(createSubstitution((await request.json()) as Record<string, unknown>), {
      status: 201,
    });
  } catch (error) {
    return commandResponse(error);
  }
}
export async function PUT(request: Request) {
  try {
    return Response.json(updateSubstitution((await request.json()) as Record<string, unknown>));
  } catch (error) {
    return commandResponse(error);
  }
}
export async function DELETE(request: Request) {
  try {
    return Response.json(deleteSubstitution(new URL(request.url).searchParams.get("id")));
  } catch (error) {
    return commandResponse(error);
  }
}

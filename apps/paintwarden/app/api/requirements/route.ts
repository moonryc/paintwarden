import {
  addRequirement,
  updateRequirement,
  deleteRequirement,
  replaceRequirements,
} from "../../../lib/commands/miniature-recipe.ts";
import { commandResponse } from "../../../lib/commands/miniatures.ts";

export async function POST(request: Request) {
  try {
    return Response.json(addRequirement(await request.json().catch(() => null)), { status: 201 });
  } catch (error) {
    return commandResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    return Response.json(updateRequirement(await request.json().catch(() => null)));
  } catch (error) {
    return commandResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    return Response.json(deleteRequirement(await request.json().catch(() => null)));
  } catch (error) {
    return commandResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    return Response.json(replaceRequirements(await request.json().catch(() => null)));
  } catch (error) {
    return commandResponse(error);
  }
}

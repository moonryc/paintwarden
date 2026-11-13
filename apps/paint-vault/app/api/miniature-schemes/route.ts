import { setMiniatureSchemes } from "../../../lib/commands/miniature-recipe.ts";
import { commandResponse } from "../../../lib/commands/miniatures.ts";

export async function PUT(request: Request) {
  try {
    return Response.json(setMiniatureSchemes(await request.json().catch(() => null)));
  } catch (error) {
    return commandResponse(error);
  }
}

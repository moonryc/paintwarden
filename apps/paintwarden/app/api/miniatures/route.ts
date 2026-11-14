import {
  commandResponse,
  createMiniature,
  withPreparedMiniatureImage,
  type MiniatureInput,
} from "../../../lib/commands/miniatures.ts";
import { serializeImageMutation } from "../../../lib/image-mutations.ts";

export const POST = serializeImageMutation(async function POST(request: Request) {
  try {
    const body = (await request.json()) as MiniatureInput;
    const row = await withPreparedMiniatureImage(body, (key) => createMiniature(body, key));
    return Response.json(row, { status: 201 });
  } catch (error) {
    return commandResponse(error);
  }
});

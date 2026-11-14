import {
  type CustomPaintInput,
  commandResponse,
  deleteCustomPaint,
  updateCustomPaint,
} from "../../../../lib/commands/paints.ts";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return Response.json(updateCustomPaint(id, (await request.json()) as CustomPaintInput));
  } catch (error) {
    return commandResponse(error);
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return Response.json(deleteCustomPaint(id));
  } catch (error) {
    return commandResponse(error);
  }
}

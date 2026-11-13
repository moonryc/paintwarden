import { PaintStockError, setPaintStock, type SetPaintStockInput } from "../../../lib/paint-stock";

export async function PUT(request: Request) {
  const input = (await request.json()) as SetPaintStockInput;
  try {
    return Response.json(setPaintStock(input));
  } catch (error) {
    if (error instanceof PaintStockError)
      return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

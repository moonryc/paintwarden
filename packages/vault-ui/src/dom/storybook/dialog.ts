import { expect, waitFor } from "storybook/test";

/** DOM queries can resolve while MUI's opening Fade still has opacity zero. */
export async function waitForDialogEntered(dialog: HTMLElement) {
  const transition = dialog.closest(".MuiDialog-container");
  await expect(transition).not.toBeNull();
  // Await the observable end state, not a fixed delay or a retry of the story.
  await waitFor(async () => {
    await expect(transition).toHaveStyle({ opacity: "1" });
    await expect(dialog).toBeVisible();
  });
}

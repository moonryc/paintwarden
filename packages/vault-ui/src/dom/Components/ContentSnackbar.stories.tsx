import { Alert, Button } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { ContentSnackbar } from "./ContentSnackbar";

const meta = {
  title: "Components/ContentSnackbar",
  component: ContentSnackbar,
  args: {
    open: true,
    children: (
      <Alert severity="error" onClose={fn()} action={<Button color="inherit">Retry</Button>}>
        Could not save your work. Please retry when the server is available.
      </Alert>
    ),
  },
  parameters: { fullBleed: true },
} satisfies Meta<typeof ContentSnackbar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Error: Story = {};

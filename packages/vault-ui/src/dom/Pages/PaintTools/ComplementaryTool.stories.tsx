import { ApolloClient, ApolloLink } from "@apollo/client";
import { Box } from "@mui/material";
import { derivePaintRoles } from "@paintwarden/core/color-matching";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState, type ReactNode } from "react";
import { Observable } from "rxjs";
import { expect, userEvent, within } from "storybook/test";

import { createVaultCache } from "../../graphql/cache";
import { VaultInvalidationController } from "../../graphql/invalidation";
import { VaultGraphQLContext } from "../../graphql/provider";
import { i18n } from "../../i18n";
import type { SchemeInput } from "../../graphql/scheme-actions";

import { ComplementaryTool } from "./ComplementaryTool";

const baseHex = "#885533";
const targets = derivePaintRoles(baseHex, "base", 50);
const makePaint = (id: string, name: string, hex: string | null, owned = true) => ({
  id,
  name,
  hex,
  owned,
  available: owned,
  brand: "Example",
});
const base = makePaint("input", "Copper base", baseHex);
const paints = [
  base,
  makePaint("shadow", "Deep shadow", targets.shadow),
  makePaint("highlight", "Pale highlight", targets.highlight),
  makePaint("complement", "Cool complement", targets.complement),
  makePaint("alternative", "Blue alternative", "#228899"),
  makePaint("unowned", "Unowned exact match", targets.complement, false),
  makePaint("invalid", "No color", null),
];
function Connection({
  children,
  mode = "normal",
  delay = 0,
  failSave = false,
}: {
  children: ReactNode;
  mode?: "normal" | "empty" | "far" | "error";
  delay?: number;
  failSave?: boolean;
}) {
  const [saved, setSaved] = useState<SchemeInput | null>(null);
  const [scope] = useState(() => {
    let seq = 1;
    let failed = false;
    let saveFailed = false;
    const controller = new VaultInvalidationController();
    const client = new ApolloClient({
      cache: createVaultCache(),
      link: new ApolloLink(
        (operation) =>
          new Observable((observer) => {
            const respond = () => {
              const revision = { epoch: "complementary-story", seq: String(seq) };
              if (operation.operationName === "ColorToolIndex") {
                if (mode === "error" && !failed) {
                  failed = true;
                  observer.error(new Error("Color connection interrupted"));
                  return;
                }
                const nodes =
                  mode === "empty"
                    ? paints.map((paint) => ({
                        ...paint,
                        owned: paint.id === "input",
                        available: paint.id === "input",
                      }))
                    : mode === "far"
                      ? [base, makePaint("far", "Distant black", "#000000")]
                      : paints;
                observer.next({
                  data: {
                    colorIndex: { revision, nodes, pageInfo: { hasNextPage: false, endCursor: null } },
                  },
                });
              } else if (operation.operationName === "PaintPickerOptions") {
                const search = String(operation.variables.search).toLowerCase();
                observer.next({
                  data: {
                    paintOptions: {
                      revision,
                      items: paints
                        .filter((paint) => paint.name.toLowerCase().includes(search))
                        .map((paint) => ({
                          __typename: "Paint",
                          id: paint.id,
                          name: paint.name,
                          brand: paint.brand,
                          range: "Standard",
                          colorHex: paint.hex,
                          sourceUrl: null,
                          isCustom: false,
                          sourceName: null,
                          sourceLogoUrl: null,
                          inventory: paint.owned ? { state: "OWNED", stockLevel: "FULL", quantity: 1 } : null,
                          available: paint.available,
                          hasActiveSubstitution: false,
                          brokenReason: null,
                          missingStock: !paint.owned,
                          brokenSubstitution: false,
                          activeSubstitution: null,
                        })),
                    },
                  },
                });
              } else if (operation.operationName === "CreateColorScheme") {
                if (failSave && !saveFailed) {
                  saveFailed = true;
                  observer.error(new Error("Save connection interrupted"));
                  return;
                }
                setSaved(operation.variables.input as SchemeInput);
                seq++;
                observer.next({
                  data: {
                    createScheme: {
                      schemeId: "saved",
                      revision: { ...revision, seq: String(seq) },
                      invalidatedFamilies: ["SCHEMES"],
                      clientMutationId: operation.variables.clientMutationId,
                    },
                  },
                });
              } else {
                observer.error(new Error(`Unexpected operation ${operation.operationName}`));
                return;
              }
              observer.complete();
            };
            const timer = setTimeout(respond, operation.operationName === "ColorToolIndex" ? delay : 0);
            return () => clearTimeout(timer);
          }),
      ),
    });
    return {
      client,
      controller,
      dispose() {
        controller.dispose();
        client.stop();
      },
    };
  });
  useEffect(() => () => scope.dispose(), [scope]);
  return (
    <VaultGraphQLContext.Provider value={scope}>
      {children}
      {saved && (
        <Box
          component="pre"
          data-testid="saved-scheme"
          sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
        >
          {JSON.stringify(saved)}
        </Box>
      )}
    </VaultGraphQLContext.Provider>
  );
}
const meta = {
  title: "Paint tools/Complementary",
  component: ComplementaryTool,
  decorators: [
    (Story, context) => (
      <Connection
        mode={context.parameters.mode ?? "normal"}
        delay={context.parameters.queryDelay ?? 0}
        failSave={context.parameters.failSave ?? false}
      >
        <Story />
      </Connection>
    ),
  ],
  beforeEach: () => {
    localStorage.removeItem("paintwarden.complementary.strength");
  },
} satisfies Meta<typeof ComplementaryTool>;
export default meta;
type Story = StoryObj<typeof meta>;

async function selectInput(canvasElement: HTMLElement, name = "Copper base") {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("combobox", { name: "Paint" }));
  await userEvent.click(
    await within(canvasElement.ownerDocument.body).findByRole("option", { name: new RegExp(name) }),
  );
}
export const OwnedMatchesAndSave: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await selectInput(canvasElement);
    const complement = await canvas.findByRole("region", { name: "Complement" });
    const highlight = canvas.getByRole("region", { name: "Highlight" });
    const shadow = canvas.getByRole("region", { name: "Shadow" });
    await expect(
      within(complement).getByRole("button", { name: /Cool complement.*Selected match/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      within(highlight).getByRole("button", { name: /Pale highlight.*Selected match/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(within(shadow).getByRole("button", { name: /Deep shadow.*Selected match/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(canvas.queryByRole("button", { name: /Copper base/ })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: /Unowned exact match/ })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Save as scheme" }));
    const dialog = within(
      await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: "Save as scheme" }),
    );
    const name = dialog.getByRole("textbox", { name: "Scheme name" });
    await expect(name).toHaveValue("Copper base set");
    await userEvent.clear(name);
    await expect(dialog.getByRole("button", { name: "Save as scheme" })).toBeDisabled();
    await userEvent.type(name, "Copper armor");
    await userEvent.click(dialog.getByRole("button", { name: "Save as scheme" }));
    const saved = JSON.parse((await canvas.findByTestId("saved-scheme")).textContent ?? "{}") as SchemeInput;
    await expect(saved).toEqual({
      name: "Copper armor",
      category: "GREY",
      entries: ["shadow", "input", "highlight", "complement"].map((paintId) => ({ type: "PAINT", paintId })),
    });
    await expect(within(canvasElement.ownerDocument.body).queryByRole("dialog")).not.toBeInTheDocument();
  },
};
export const RoleReversalAndLiveStrength: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await selectInput(canvasElement);
    for (const role of ["highlight", "shadow", "complement", "base"] as const) {
      const name = role[0].toUpperCase() + role.slice(1);
      await userEvent.click(canvas.getByRole("combobox", { name: "Input role" }));
      await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole("option", { name }));
      const derived = derivePaintRoles(baseHex, role, 50);
      for (const other of ["base", "complement", "highlight", "shadow"] as const) {
        if (other === role) {
          await expect(canvas.queryByRole("region", { name })).not.toBeInTheDocument();
        } else {
          const region = canvas.getByRole("region", {
            name: other[0].toUpperCase() + other.slice(1),
          });
          await expect(within(region).getByText(`Target ${derived[other]}`)).toBeInTheDocument();
        }
      }
    }
    const slider = canvas.getByRole("slider", { name: "Highlight and shadow strength" });
    await userEvent.click(slider);
    await userEvent.keyboard("{End}");
    await expect(slider).toHaveValue("100");
    await expect(localStorage.getItem("paintwarden.complementary.strength")).toBe("100");
    await expect(
      within(canvas.getByRole("region", { name: "Highlight" })).getByText(
        `Target ${derivePaintRoles(baseHex, "base", 100).highlight}`,
      ),
    ).toBeInTheDocument();
    await userEvent.keyboard("{Home}");
    await expect(slider).toHaveValue("0");
    await expect(
      within(canvas.getByRole("region", { name: "Shadow" })).getByText(
        `Target ${derivePaintRoles(baseHex, "base", 0).shadow}`,
      ),
    ).toBeInTheDocument();
  },
};
export const OwnedAlternatives: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await selectInput(canvasElement);
    const complement = within(await canvas.findByRole("region", { name: "Complement" }));
    const alternative = complement.getByRole("button", { name: /Blue alternative/ });
    await userEvent.click(alternative);
    await expect(alternative).toHaveAttribute("aria-pressed", "true");
    await expect(complement.getByRole("button", { name: /Cool complement/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  },
};
export const NoOwnedMatches: Story = {
  parameters: { mode: "empty" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await selectInput(canvasElement);
    await expect(
      await canvas.findAllByText("No owned paints with a valid color are available for this role."),
    ).toHaveLength(3);
    await expect(canvas.getByRole("button", { name: "Save as scheme" })).toBeDisabled();
  },
};
export const NoCloseMatches: Story = {
  parameters: { mode: "far" },
  play: async ({ canvasElement }) => {
    await selectInput(canvasElement);
    await expect(
      await within(canvasElement).findAllByText(
        "No close owned match for this role. Nearest suggestions are shown below.",
      ),
    ).toHaveLength(3);
  },
};
export const InvalidColor: Story = {
  play: async ({ canvasElement }) => {
    await selectInput(canvasElement, "No color");
    await expect(
      await within(canvasElement).findByText(
        "Add a valid hex color to this paint to compare it with the catalog.",
      ),
    ).toBeInTheDocument();
  },
};
export const ReadFailureRetry: Story = {
  parameters: { mode: "error" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Color connection interrupted")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await selectInput(canvasElement);
    await expect(await canvas.findByRole("region", { name: "Highlight" })).toBeVisible();
  },
};
export const SaveFailureRetry: Story = {
  parameters: { failSave: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await selectInput(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Save as scheme" }));
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Save as scheme" }));
    await expect(await dialog.findByText("Could not save the scheme. Try again.")).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Save as scheme" }));
    await expect(await canvas.findByTestId("saved-scheme")).toBeInTheDocument();
  },
};
export const Loading: Story = {
  parameters: { queryDelay: 750 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("status")).toHaveAttribute("aria-live", "polite");
    await expect(canvasElement.querySelector('[data-skeleton="complementary"]')).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(
      await canvas.findByText("Choose a paint to generate the other three roles."),
    ).toBeInTheDocument();
  },
};
async function localizedPhone(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const frame = canvas.getByTestId("phone-frame");
  await userEvent.click(canvas.getByRole("combobox", { name: i18n.t("pages:toolsPaint") }));
  await userEvent.click(
    await within(canvasElement.ownerDocument.body).findByRole("option", { name: /Copper base/ }),
  );
  await expect(await canvas.findAllByRole("region")).toHaveLength(3);
  await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth);
  for (const region of canvas.getAllByRole("region")) {
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth);
  }
  await userEvent.click(canvas.getByRole("button", { name: i18n.t("pages:complementarySave") }));
  const dialog = within(
    await within(canvasElement.ownerDocument.body).findByRole("dialog", {
      name: i18n.t("pages:complementarySave"),
    }),
  );
  await expect(dialog.getByRole("textbox", { name: i18n.t("pages:complementaryName") })).toHaveValue(
    i18n.t("pages:complementaryDefaultName", { name: "Copper base" }),
  );
  await userEvent.keyboard("{Escape}");
  await expect(within(canvasElement.ownerDocument.body).queryByRole("dialog")).not.toBeInTheDocument();
}
const phoneDecorators: Story["decorators"] = [
  (Story) => (
    <Box data-testid="phone-frame" sx={{ width: 320, maxWidth: "100%" }}>
      <Story />
    </Box>
  ),
];
export const Phone: Story = {
  decorators: phoneDecorators,
  play: ({ canvasElement }) => localizedPhone(canvasElement),
};
export const GermanPhone: Story = {
  parameters: { locale: "de" },
  decorators: phoneDecorators,
  play: ({ canvasElement }) => localizedPhone(canvasElement),
};
export const JapanesePhone: Story = {
  parameters: { locale: "ja" },
  decorators: phoneDecorators,
  play: ({ canvasElement }) => localizedPhone(canvasElement),
};
export const PolishPhone: Story = {
  parameters: { locale: "pl" },
  decorators: phoneDecorators,
  play: ({ canvasElement }) => localizedPhone(canvasElement),
};

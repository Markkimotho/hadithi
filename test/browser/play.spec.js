import { test, expect } from "@playwright/test";

async function move(page, label) {
  const interrupt = page.getByText("ENCOUNTER IN PROGRESS", { exact: true });
  if (await interrupt.count()) {
    const shelter = page.locator(".actions").getByRole("button", {
      name: /Wait under the rock overhang|Shelter in a wall niche|Wait silently until the boots pass/,
    });
    await shelter.click();
  }
  await page.locator(".actions").getByRole("button", { name: label }).click();
}
async function start(page, index) {
  await page.goto("/");
  await page.locator("[data-start]").nth(index).click();
}

test("collection, sources, filters and visual layout", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Every story has/ }),
  ).toBeVisible();
  await expect(page.locator(".story-card")).toHaveCount(3);
  await page.screenshot({
    path: `artifacts/collection-${info.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Asia", exact: true }).click();
  await expect(page.locator(".story-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "The Palace Beneath the Tide" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All tales", exact: true }).click();
  await page.getByRole("button", { name: "Field notes", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Where the stories began" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Read the source collection ↗" }),
  ).toHaveCount(3);
  await page.getByRole("button", { name: "Close dialog" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("objects, crafting, genre shift, journal and autosave resume", async ({
  page,
}, info) => {
  await start(page, 0);
  await move(page, /Study the covered footprints/);
  await expect(page.getByText("TURN 00", { exact: true })).toBeVisible();
  await move(page, /Lift the loose palm cord/);
  await move(page, /Visit the waking market/);
  await move(page, /Ask for the spare cloth/);
  await page.getByRole("button", { name: /Weave a carrying sling/ }).click();
  await expect(
    page.getByRole("button", { name: "Carrying sling", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Carrying sling", exact: true })
    .click();
  await expect(page.locator(".item-detail")).toContainText(
    "leaves both hands free",
  );
  await page.getByRole("button", { name: /Shift the tale/ }).click();
  await page.locator('[data-theme="mystery"]').click();
  await expect(page.locator(".theme-box")).toContainText("Mystery");
  await page.getByRole("tab", { name: /Clues/ }).click();
  await expect(page.locator(".clue-list")).toContainText("heavy load");
  await page.screenshot({
    path: `artifacts/play-${info.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.reload();
  await page.getByRole("button", { name: /Resume journey/ }).click();
  await expect(
    page.getByRole("heading", { name: "Things people know" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Carrying sling", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".theme-box")).toContainText("Mystery");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("wisdom: hands-on puzzle, interruption and a complete ending", async ({
  page,
}, info) => {
  await start(page, 0);
  await move(page, /Visit the waking market/);
  await move(page, /Help repair the jar and listen/);
  await move(page, /Return to the courtyard/);
  await move(page, /Follow Anansi into the forest/);
  await move(page, /Follow the low path/);
  await move(page, /Examine the stepping stones/);
  await move(page, /Wade along the bank/);
  await move(page, /Approach the tallest tree/);
  await move(page, /Work out a safer carrying knot/);
  if (await page.getByText("ENCOUNTER IN PROGRESS", { exact: true }).count())
    await page
      .getByRole("button", { name: /Wait under the rock overhang/ })
      .click();
  await page.getByRole("button", { name: "Make a loop", exact: true }).click();
  await page.getByRole("button", { name: "Move behind", exact: true }).click();
  await page.getByRole("button", { name: "Tighten", exact: true }).click();
  await expect(page.getByText("✓ SOLVED", { exact: true })).toBeVisible();
  await move(page, /Demonstrate the carrying knot/);
  await move(page, /Ask Anansi to lower it with you/);
  await move(page, /Carry the question back to the grove/);
  await move(page, /Open the pot together/);
  await expect(
    page.getByRole("heading", { name: "A circle wide enough" }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/ending-${info.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: /Try the last turning point/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "A pot is also a circle" }),
  ).toBeVisible();
  await move(page, /Release the wisdom into the wind/);
  await expect(
    page.getByRole("heading", { name: "What the wind remembers" }),
  ).toBeVisible();
});

test("tide: choose a new home and see collection completion", async ({
  page,
}) => {
  await start(page, 1);
  for (const label of [
    /Work the knot loose by hand/,
    /Follow the green road underwater/,
    /Follow the quiet bells/,
    /Enter the hall of four seasons/,
    /Sit down with Otohime/,
    /Explore what a life here would mean/,
    /Choose to make a life beneath the sea/,
  ])
    await move(page, label);
  await expect(
    page.getByRole("heading", { name: "A life with the tide" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Choose another tale/ }).click();
  await expect(page.locator(".discovery-count")).toContainText("01 / 09");
});

test("orchestra: investigate, recruit a witness and bring a case to town", async ({
  page,
}) => {
  await start(page, 2);
  await page.getByRole("button", { name: /Shift the tale/ }).click();
  await page.locator('[data-theme="mystery"]').click();
  for (const label of [
    /Speak to the dog in the shade/,
    /Invite him to join at his own pace/,
    /Continue to the orchard/,
    /Ask what song she would choose/,
    /Follow the crowing at the next gate/,
    /Promise every voice a turn/,
    /Take the path into the wood/,
    /Watch the house from cover/,
    /Read the names on the sacks/,
    /Send the cat to scout the pantry/,
    /Lift the ledger and risk the floorboards/,
    /Follow a whisper behind the shed/,
    /Share what you found and arrange a meeting/,
    /Meet the miller beyond the orchard/,
    /Take the ledger and witness to town/,
  ])
    await move(page, label);
  await expect(
    page.getByRole("heading", { name: "The case of the midnight orchestra" }),
  ).toBeVisible();
});

test("keyboard play and accessibility preferences remain usable", async ({
  page,
}) => {
  await start(page, 0);
  await page.keyboard.press("1");
  await expect(page.locator(".consequence")).toContainText("heavy load");
  await page.getByRole("button", { name: "Open game settings" }).click();
  await page.getByLabel("Scene motion").uncheck();
  await page.getByLabel("Story text size").selectOption("large");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-motion", "off");
  await expect(page.locator("body")).toHaveAttribute("data-text", "large");
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-motion", "off");
});

test("portable save export and import reconstruct the journey", async ({
  page,
}) => {
  await start(page, 0);
  await move(page, /Lift the loose palm cord/);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export save ↓" }).click();
  const download = await downloadPromise;
  await page.getByRole("button", { name: "Open game settings" }).click();
  await page.locator("#import-file").setInputFiles(await download.path());
  await expect(
    page.getByRole("heading", { name: "A secret at daybreak" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Bag/ }).click();
  await expect(
    page.getByRole("button", { name: "Palm cord", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("TURN 01", { exact: true })).toBeVisible();
});

test("an incompatible browser save offers a clear new journey", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "hadithi.v1.save.wisdom",
      JSON.stringify({
        version: 0,
        episodeId: "wisdom",
        revision: 0,
        actions: [],
      }),
    ),
  );
  await start(page, 0);
  await expect(
    page.getByRole("heading", { name: "A different edition" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start a new journey →" }).click();
  await expect(
    page.getByRole("heading", { name: "A secret at daybreak" }),
  ).toBeVisible();
});

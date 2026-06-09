export function renderScreenLinks(screens) {
  return screens
    .map((screen) => `<a href="/${screen.id}/">${screen.title}</a>`)
    .join("\n");
}

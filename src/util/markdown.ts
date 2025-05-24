/**
 * Extremely dumb Markdown renderer to avoid unnecessary dependencies.
 */
export function markdown(str: string) {
  return str
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/\[([^]]*)\]\(([^)]*)\)/g, "<a href=\"$2\">$1</a>")
    .replace(/(?:(?:^[*]\s+(.*)\n)|(?:^[*]\s+(.*)$))+/mg, (match) =>
      `<ul class="list-disc list-inside ml-2">${
        match.trim().split("\n")
          .map(item => `<li>${item.replace(/^\* /, "")}</li>`)
          .join("")
      }</ul>`)
    .replace(/(?:(?:^[0-9]*\.\s+(.*)\n)|(?:^[0-9]*\.\s+(.*)$))+/mg, (match) =>
      `<ol class="list-decimal list-inside ml-2">${
        match.trim().split("\n")
          .map(item => `<li>${item.replace(/^[0-9]*\. /, "")}</li>`)
          .join("")
      }</ol>`)
    .replace(/\n/g, "<br>")
}
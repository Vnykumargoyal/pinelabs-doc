import { useParams } from "react-router-dom";
import MarkdownRenderer from "../components/MarkdownRenderer";
import TableOfContents from "../components/TableOfContents";
import { lifecycleContent } from "../content/concepts/lifecycle";
import { transportsContent } from "../content/concepts/transports";
import { capabilitiesContent } from "../content/concepts/capabilities";
import { eventIdContent } from "../content/concepts/eventId";
import { errorHandlingContent } from "../content/concepts/errorHandling";
import { resultPayloadContent } from "../content/concepts/resultPayload";
import { versioningContent } from "../content/concepts/versioning";
import { csvContent, padControllerContent } from "../content/wireFormats";

const conceptMap: Record<string, string> = {
  lifecycle: lifecycleContent,
  transports: transportsContent,
  capabilities: capabilitiesContent,
  eventid: eventIdContent,
  "error-handling": errorHandlingContent,
  "result-payload": resultPayloadContent,
  versioning: versioningContent,
  csv: csvContent,
  "pad-controller-frame": padControllerContent,
};

export default function ConceptPage() {
  const { slug } = useParams<{ slug: string }>();
  const content = slug
    ? conceptMap[slug] ?? `# Not found\n\nNo content for \`${slug}\`.`
    : "# Select a topic";

  return (
    <div className="flex max-w-6xl mx-auto relative">
      <main className="flex-1 min-w-0 px-8 lg:px-10 py-10 max-w-3xl">
        <MarkdownRenderer content={content} />
      </main>
      <div
        className="hidden xl:block px-6 py-10 flex-shrink-0 fixed top-[var(--topbar-height)]"
        style={{ width: "calc(var(--toc-width) + 24px)", right: "50px" }}
      >
        <TableOfContents markdown={content} />
      </div>
    </div>
  );
}

import { SavedReportPage } from "@/components/report-pages";

export default function ResultsPage({
  params,
}: {
  params: { trackingId: string };
}) {
  return <SavedReportPage trackingId={params.trackingId} />;
}

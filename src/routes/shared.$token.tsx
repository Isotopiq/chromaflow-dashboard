import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, FileText } from "lucide-react";
import { ChromatogramPlot } from "@/components/chromatogram-plot";
import { PeakTable } from "@/components/peak-table";
import { getSharedResource } from "@/lib/lab.functions";

export const Route = createFileRoute("/shared/$token")({
  component: SharedView,
});

function SharedView() {
  const { token } = Route.useParams();
  const fetchFn = useServerFn(getSharedResource);
  const { data, isLoading, error } = useQuery({
    queryKey: ["shared", token],
    queryFn: () => fetchFn({ data: { token } }),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-3">
        <div className="text-[10px] uppercase tracking-[0.2em] text-primary">
          CHROMA.LAB · Shared view
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Read-only public link · token <span className="font-mono">{token.slice(0, 8)}…</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading shared resource…
          </div>
        )}

        {error && (
          <Card className="flex items-center gap-2 border-destructive/40 bg-destructive/5 p-4 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span>{(error as any)?.message ?? "Unable to open this link."}</span>
          </Card>
        )}

        {data?.kind === "report" && (
          <Card className="border-border bg-card p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{data.title}</span>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {data.template}
                </Badge>
              </div>
              <a
                href={data.url}
                target="_blank"
                rel="noopener"
                className="text-xs text-primary underline"
              >
                Open PDF
              </a>
            </div>
            <iframe
              src={data.url}
              title={data.title}
              className="h-[80vh] w-full"
            />
          </Card>
        )}

        {data?.kind === "run" && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="font-mono text-xl font-semibold tracking-tight">
                {data.run.name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">
                  {data.run.ionMode === "positive" ? "ESI +" : "ESI −"}
                </Badge>
                <span>{data.run.fileSize}</span>
                <span>·</span>
                <span>{data.run.peaks.length} peaks</span>
              </div>
            </div>

            <Card className="border-border bg-card p-4">
              <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                TIC chromatogram
              </div>
              <ChromatogramPlot runs={[data.run]} height={260} showPeaks />
            </Card>

            <Card className="border-border bg-card p-3">
              <div className="mb-2 px-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                Peak table
              </div>
              <PeakTable peaks={data.run.peaks} />
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

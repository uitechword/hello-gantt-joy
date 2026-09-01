import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Project Gantt — Hello" },
      { name: "description", content: "A simple one-page project Gantt chart." },
      { property: "og:title", content: "Project Gantt — Hello" },
      { property: "og:description", content: "A simple one-page project Gantt chart." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GanttPage,
});

const tasks = [
  { id: 1, name: "Project kickoff", start: 1, duration: 3, color: "bg-primary" },
  { id: 2, name: "Requirements", start: 3, duration: 4, color: "bg-chart-2" },
  { id: 3, name: "Design", start: 6, duration: 5, color: "bg-chart-4" },
  { id: 4, name: "Development", start: 10, duration: 7, color: "bg-chart-1" },
  { id: 5, name: "Testing", start: 16, duration: 4, color: "bg-chart-3" },
  { id: 6, name: "Launch", start: 20, duration: 2, color: "bg-chart-5" },
];

const totalWeeks = 22;

function GanttPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            hello
          </h1>
          <p className="text-muted-foreground">
            Simple project timeline overview.
          </p>
        </header>

        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <div className="min-w-[720px] p-6">
            <div className="grid" style={{ gridTemplateColumns: `200px repeat(${totalWeeks}, minmax(28px, 1fr))` }}>
              {/* Header row */}
              <div className="text-sm font-semibold text-foreground">Task</div>
              {Array.from({ length: totalWeeks }, (_, i) => (
                <div
                  key={i}
                  className="border-l border-border py-2 text-center text-xs text-muted-foreground"
                >
                  W{i + 1}
                </div>
              ))}

              {/* Task rows */}
              {tasks.map((task) => (
                <>
                  <div
                    key={`label-${task.id}`}
                    className="flex items-center border-t border-border py-3 text-sm font-medium text-foreground"
                  >
                    {task.name}
                  </div>
                  {Array.from({ length: totalWeeks }, (_, i) => (
                    <div
                      key={`cell-${task.id}-${i}`}
                      className="border-l border-t border-border"
                    />
                  ))}
                  <div
                    className={`col-span-${task.duration} ${task.color} col-start-${task.start + 1} row-start-auto my-2 h-6 rounded-full opacity-90`}
                    style={{
                      gridColumn: `${task.start + 1} / span ${task.duration}`,
                    }}
                    title={`${task.name}: weeks ${task.start}–${task.start + task.duration - 1}`}
                  />
                </>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

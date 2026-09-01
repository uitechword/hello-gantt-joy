import { createFileRoute } from "@tanstack/react-router";
import { GanttChart } from "@/components/gantt/GanttChart";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GanttFlow Pro — Project Gantt Chart" },
      {
        name: "description",
        content:
          "GanttFlow Pro: an interactive project Gantt chart with task hierarchy, dependencies, resources, critical path, and calendar planning.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "GanttFlow Pro — Project Gantt Chart" },
      {
        property: "og:description",
        content:
          "Interactive Gantt chart with tasks, dependencies, resources, critical path, and calendar planning.",
      },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return <GanttChart />;
}

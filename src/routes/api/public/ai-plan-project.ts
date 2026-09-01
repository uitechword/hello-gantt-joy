import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/ai-plan-project")({
  server: {
    handlers: {
      POST: async () => {
        return Response.json(
          {
            error:
              "AI project planning is not configured yet. Enable Lovable Cloud to turn on the AI planner.",
          },
          { status: 501 },
        );
      },
    },
  },
});

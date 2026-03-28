import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { InterviewClient } from "@/components/interview/interview-client";
import type { DbSearchProfile } from "@/lib/types/flatguard";

interface InterviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function InterviewPage({ params }: InterviewPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const { data: profile } = await supabase
    .from("search_profiles")
    .select("*")
    .eq("project_id", id)
    .eq("is_current", true)
    .maybeSingle();

  return (
    <InterviewClient
      projectId={project.id}
      initialProfile={(profile as DbSearchProfile) ?? null}
    />
  );
}

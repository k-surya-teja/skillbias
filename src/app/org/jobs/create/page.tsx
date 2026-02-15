"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button, Label, Select, TextInput, Textarea } from "flowbite-react";
import { X } from "lucide-react";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { createJob } from "@/lib/ats";
import { ensureAtsSessionFromClerk } from "@/lib/ats/clerkSession";

type FormFieldDraft = {
  label: string;
  type: "text" | "number" | "email" | "file" | "select" | "textarea" | "date";
  required: boolean;
  options?: string[];
};

export default function CreateJobPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [endDate, setEndDate] = useState("");
  const [formFields, setFormFields] = useState<FormFieldDraft[]>([]);
  const [error, setError] = useState("");
  const [freeJobAlert, setFreeJobAlert] = useState<string>("");

  useEffect(() => {
    void (async () => {
      try {
        const organization = await ensureAtsSessionFromClerk(getToken);
        if (organization.plan === "free" && organization.freeJobUsed === false) {
          setFreeJobAlert("Free plan includes 1 job post. This will use your free job credit.");
        }
      } catch {
        // Keep silent here; route auth errors are handled by API responses.
      }
    })();
  }, [getToken]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createJob({
        title,
        description,
        requirements,
        requiredSkills,
        endDate: new Date(endDate).toISOString(),
        formFields,
      });
      router.push("/org/jobs");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create job");
    }
  }

  function addField() {
    setFormFields((prev) => [...prev, { label: "", type: "text", required: false }]);
  }

  function updateField(index: number, patch: Partial<FormFieldDraft>) {
    setFormFields((prev) => prev.map((field, idx) => (idx === index ? { ...field, ...patch } : field)));
  }

  function addSkill(rawSkill: string) {
    const skill = rawSkill.trim();
    if (!skill) {
      return;
    }

    setRequiredSkills((prev) => {
      if (prev.some((existing) => existing.toLowerCase() === skill.toLowerCase())) {
        return prev;
      }
      return [...prev, skill];
    });
  }

  function onSkillsKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addSkill(skillsInput);
      setSkillsInput("");
    }
  }

  function removeSkill(skillToRemove: string) {
    setRequiredSkills((prev) => prev.filter((skill) => skill !== skillToRemove));
  }

  return (
    <OrgPageShell>
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
        Create Job
      </h1>

      {freeJobAlert && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {freeJobAlert}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950"
      >
          <div>
            <Label htmlFor="title">Title</Label>
            <TextInput id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="requirements">Requirements</Label>
            <Textarea
              id="requirements"
              rows={4}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="skills">Required Skills</Label>
            <TextInput
              id="skills"
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
              onKeyDown={onSkillsKeyDown}
              onBlur={() => {
                if (skillsInput.trim()) {
                  addSkill(skillsInput);
                  setSkillsInput("");
                }
              }}
              placeholder="Type a skill and press Enter"
            />
            {requiredSkills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {requiredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="rounded-full p-0.5 hover:bg-indigo-200/60 dark:hover:bg-indigo-800/60"
                      aria-label={`Remove ${skill}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <TextInput
              id="endDate"
              type="datetime-local"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium">Custom Form Fields</p>
              <Button color="light" type="button" onClick={addField}>
                Add Field
              </Button>
            </div>

            <div className="space-y-3">
              {formFields.map((field, index) => (
                <div key={`${index}-${field.type}`} className="grid gap-2 md:grid-cols-3">
                  <TextInput
                    placeholder="Label"
                    value={field.label}
                    onChange={(e) => updateField(index, { label: e.target.value })}
                  />
                  <Select
                    value={field.type}
                    onChange={(e) =>
                      updateField(index, {
                        type: e.target.value as FormFieldDraft["type"],
                      })
                    }
                  >
                    <option value="text">text</option>
                    <option value="number">number</option>
                    <option value="email">email</option>
                    <option value="file">file</option>
                    <option value="select">select</option>
                    <option value="textarea">textarea</option>
                    <option value="date">date</option>
                  </Select>
                  <Select
                    value={field.required ? "yes" : "no"}
                    onChange={(e) => updateField(index, { required: e.target.value === "yes" })}
                  >
                    <option value="no">Optional</option>
                    <option value="yes">Required</option>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <Button type="submit">Create</Button>
      </form>
    </OrgPageShell>
  );
}

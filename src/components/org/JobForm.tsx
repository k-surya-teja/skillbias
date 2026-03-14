"use client";

import { FormEvent, KeyboardEvent, useState } from "react";
import { Button, Checkbox, Label, Select, TextInput, Textarea } from "flowbite-react";
import { X } from "lucide-react";
import { Job, JobFormField } from "@/lib/ats/types";

type FormFieldDraft = {
  label: string;
  type: JobFormField["type"];
  required: boolean;
  options?: string[];
};

export type JobFormPayload = {
  title: string;
  description: string;
  requirements: string;
  requiredSkills: string[];
  endDate: string;
  formFields: FormFieldDraft[];
  isPublic: boolean;
};

type JobFormProps = {
  initialData?: Job;
  onSubmit: (payload: JobFormPayload) => Promise<void>;
  submitLabel: string;
};

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function JobForm({ initialData, onSubmit, submitLabel }: JobFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [requirements, setRequirements] = useState(initialData?.requirements ?? "");
  const [skillsInput, setSkillsInput] = useState("");
  const [requiredSkills, setRequiredSkills] = useState<string[]>(initialData?.requiredSkills ?? []);
  const [endDate, setEndDate] = useState(initialData?.endDate ? toDatetimeLocal(initialData.endDate) : "");
  const [formFields, setFormFields] = useState<FormFieldDraft[]>(initialData?.formFields ?? []);
  const [isPublic, setIsPublic] = useState(initialData?.isPublic ?? false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        title,
        description,
        requirements,
        requiredSkills,
        endDate: new Date(endDate).toISOString(),
        formFields,
        isPublic,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong");
    } finally {
      setSubmitting(false);
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
    if (!skill) return;
    setRequiredSkills((prev) => {
      if (prev.some((existing) => existing.toLowerCase() === skill.toLowerCase())) return prev;
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
    <form
      onSubmit={handleSubmit}
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

      <div className="flex items-start gap-3">
        <Checkbox
          id="isPublic"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        <div className="leading-none">
          <Label htmlFor="isPublic" className="font-medium">
            Make it Public
          </Label>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            This job will appear on the public jobs board for anyone to discover and apply.
          </p>
        </div>
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

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}

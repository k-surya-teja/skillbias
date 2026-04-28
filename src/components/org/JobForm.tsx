"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import { Button, Checkbox, Label, Select, TextInput, Textarea } from "flowbite-react";
import {
  Briefcase,
  CalendarDays,
  Eye,
  FileText,
  Globe,
  ListChecks,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
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

function toDateValue(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const DESC_LIMIT = 1500;
const REQ_LIMIT = 1000;

export function JobForm({ initialData, onSubmit, submitLabel }: JobFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [requirements, setRequirements] = useState(initialData?.requirements ?? "");
  const [skillsInput, setSkillsInput] = useState("");
  const [requiredSkills, setRequiredSkills] = useState<string[]>(initialData?.requiredSkills ?? []);
  const [endDate, setEndDate] = useState(initialData?.endDate ? toDateValue(initialData.endDate) : "");
  const [formFields, setFormFields] = useState<FormFieldDraft[]>(initialData?.formFields ?? []);
  const [isPublic, setIsPublic] = useState(initialData?.isPublic ?? false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const completion = useMemo(() => {
    const checks = [
      title.trim().length > 0,
      description.trim().length >= 40,
      requirements.trim().length > 0,
      requiredSkills.length > 0,
      endDate.length > 0,
    ];
    const done = checks.filter(Boolean).length;
    return { done, total: checks.length, pct: Math.round((done / checks.length) * 100) };
  }, [title, description, requirements, requiredSkills, endDate]);

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
      const msg = submitError instanceof Error ? submitError.message : "Something went wrong";
      setError(msg);
      toast.error(msg);
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

  function removeField(index: number) {
    setFormFields((prev) => prev.filter((_, idx) => idx !== index));
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
    <>
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/90 px-6 py-5 text-center shadow-2xl">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-indigo-300/40 border-t-indigo-400" />
            <p className="text-sm font-medium text-slate-100">Saving job...</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-3">
        {/* MAIN COLUMN */}
        <div className="space-y-3 lg:col-span-2">
          {/* Basics */}
          <Section icon={<Briefcase className="h-4 w-4" />} title="Basics">
            <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
              <Field label="Job title" htmlFor="title" hint="E.g. Senior Backend Engineer">
                <TextInput
                  id="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Senior Backend Engineer"
                />
              </Field>
              <Field label="Closes on" htmlFor="endDate" hint="Last day to apply">
                <TextInput
                  id="endDate"
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </Field>
            </div>
          </Section>

          {/* Description & Requirements */}
          <Section icon={<FileText className="h-4 w-4" />} title="Role details">
            <Field
              label="Description"
              htmlFor="description"
              hint="What the role does, who they'll work with, why it matters"
              right={
                <CounterPill current={description.length} max={DESC_LIMIT} min={40} />
              }
            >
              <Textarea
                id="description"
                required
                rows={5}
                maxLength={DESC_LIMIT}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="We're hiring a backend engineer to build…"
              />
            </Field>

            <Field
              label="Requirements"
              htmlFor="requirements"
              hint="Bullet what's needed — experience, must-haves, nice-to-haves"
              right={<CounterPill current={requirements.length} max={REQ_LIMIT} />}
            >
              <Textarea
                id="requirements"
                rows={4}
                maxLength={REQ_LIMIT}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="• 4+ years of Node.js&#10;• Familiar with Postgres…"
              />
            </Field>

            <Field
              label="Required skills"
              htmlFor="skills"
              hint="Press Enter or comma to add. These power resume scoring."
              right={
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {requiredSkills.length} added
                </span>
              }
            >
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
                placeholder="e.g. TypeScript, PostgreSQL, AWS"
              />
              {requiredSkills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {requiredSkills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
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
            </Field>
          </Section>

          {/* Custom Form Fields */}
          <Section
            icon={<ListChecks className="h-4 w-4" />}
            title="Application form"
            action={
              <Button color="light" size="xs" type="button" onClick={addField}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add field
              </Button>
            }
          >
            {formFields.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                Email and resume are collected by default. Add custom fields like portfolio link, notice period, etc.
              </p>
            ) : (
              <div className="space-y-2">
                {formFields.map((field, index) => (
                  <div
                    key={`${index}-${field.type}`}
                    className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-900"
                  >
                    <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr]">
                      <TextInput
                        sizing="sm"
                        placeholder="Field label (e.g. Portfolio URL)"
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                      />
                      <Select
                        sizing="sm"
                        value={field.type}
                        onChange={(e) =>
                          updateField(index, { type: e.target.value as FormFieldDraft["type"] })
                        }
                      >
                        <option value="text">Text</option>
                        <option value="textarea">Long text</option>
                        <option value="number">Number</option>
                        <option value="email">Email</option>
                        <option value="date">Date</option>
                        <option value="file">File</option>
                        <option value="select">Dropdown</option>
                      </Select>
                      <Select
                        sizing="sm"
                        value={field.required ? "yes" : "no"}
                        onChange={(e) => updateField(index, { required: e.target.value === "yes" })}
                      >
                        <option value="no">Optional</option>
                        <option value="yes">Required</option>
                      </Select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeField(index)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950 dark:hover:text-red-400"
                      aria-label="Remove field"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Visibility */}
          <Section icon={<Globe className="h-4 w-4" />} title="Visibility">
            <label
              htmlFor="isPublic"
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:border-indigo-300 dark:border-gray-800 dark:hover:border-indigo-700"
            >
              <Checkbox
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <Label htmlFor="isPublic" className="text-sm font-medium">
                  List on the public jobs board
                </Label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  When off, the role is only reachable via the direct apply link.
                </p>
              </div>
            </label>
          </Section>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-950">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {completion.done}/{completion.total}
              </span>{" "}
              required sections complete
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : submitLabel}
            </Button>
          </div>
        </div>

        {/* SIDEBAR — preview + checklist */}
        <aside className="space-y-3">
          <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
            <div className="mb-2 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Posting health
              </h3>
            </div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-2xl font-semibold text-gray-900 dark:text-white">
                {completion.pct}%
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">ready to publish</span>
            </div>
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all"
                style={{ width: `${completion.pct}%` }}
              />
            </div>
            <ul className="space-y-1 text-xs">
              <ChecklistItem done={title.trim().length > 0}>Title</ChecklistItem>
              <ChecklistItem done={description.trim().length >= 40}>
                Description (40+ chars)
              </ChecklistItem>
              <ChecklistItem done={requirements.trim().length > 0}>Requirements</ChecklistItem>
              <ChecklistItem done={requiredSkills.length > 0}>
                At least one required skill
              </ChecklistItem>
              <ChecklistItem done={endDate.length > 0}>Closing date</ChecklistItem>
            </ul>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
            <div className="mb-2 flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-gray-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Candidate preview
              </h3>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
              <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                {title || "Untitled role"}
              </h4>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                {endDate && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    Apply by {new Date(endDate).toLocaleDateString()}
                  </span>
                )}
                {isPublic ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Globe className="h-3 w-3" /> Public
                  </span>
                ) : (
                  <span>Unlisted</span>
                )}
              </div>
              <p className="mt-2 line-clamp-3 text-xs text-gray-600 dark:text-gray-300">
                {description || "Describe the role to see it here…"}
              </p>
              {requiredSkills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {requiredSkills.slice(0, 6).map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"
                    >
                      {s}
                    </span>
                  ))}
                  {requiredSkills.length > 6 && (
                    <span className="text-[10px] text-gray-500">+{requiredSkills.length - 6}</span>
                  )}
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
              Custom form fields: {formFields.length === 0 ? "none" : `${formFields.length} extra`}
            </p>
          </div>
        </aside>
      </form>
    </>
  );
}

function Section({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
          <span className="text-indigo-500">{icon}</span>
          {title}
        </h2>
        {action}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  right,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-xs font-medium text-gray-700 dark:text-gray-200">
          {label}
        </Label>
        {right}
      </div>
      {children}
      {hint && (
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{hint}</p>
      )}
    </div>
  );
}

function CounterPill({ current, max, min }: { current: number; max: number; min?: number }) {
  const tooShort = min !== undefined && current < min;
  const nearLimit = current > max * 0.85;
  return (
    <span
      className={`text-[11px] tabular-nums ${
        tooShort
          ? "text-amber-600 dark:text-amber-400"
          : nearLimit
            ? "text-rose-600 dark:text-rose-400"
            : "text-gray-500 dark:text-gray-400"
      }`}
    >
      {current}/{max}
    </span>
  );
}

function ChecklistItem({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          done
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-gray-300 dark:border-gray-700"
        }`}
      >
        {done && (
          <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor">
            <path d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-3-3a1 1 0 111.4-1.4l2.3 2.3 6.3-6.3a1 1 0 011.4 0z" />
          </svg>
        )}
      </span>
      <span className={done ? "text-gray-700 dark:text-gray-300" : "text-gray-500 dark:text-gray-400"}>
        {children}
      </span>
    </li>
  );
}

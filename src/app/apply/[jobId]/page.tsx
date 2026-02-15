"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, Label, Select, TextInput, Textarea } from "flowbite-react";
import Link from "next/link";
import { AppNavbar } from "@/components/navbar";
import {
  getPublicJob,
  submitJobApplication as submitJobApplicationRequest,
} from "@/lib/ats/applications";
import { JobFormField } from "@/lib/ats/types";

type PublicJob = {
  title: string;
  description: string;
  requirements: string;
  formFields: JobFormField[];
};

export default function ApplyPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const [job, setJob] = useState<PublicJob | null>(null);
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [resume, setResume] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    async function loadJob() {
      try {
        const response = await getPublicJob(jobId);
        setJob(response.job as PublicJob);
        setIsExpired(false);
        setError("");
      } catch (jobError) {
        const nextError = jobError instanceof Error ? jobError.message : "Failed to load job";
        if (nextError.toLowerCase().includes("expired")) {
          setIsExpired(true);
          setError("");
          return;
        }
        setError(nextError);
      }
    }

    void loadJob();
  }, [jobId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resume) {
      setError("Please upload a resume");
      return;
    }

    try {
      const response = await submitJobApplicationRequest(jobId, {
        email,
        answers,
        resume,
      });
      setMessage(response.message);
      setError("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Application failed");
    }
  }

  return (
    <main className="min-h-screen">
      <AppNavbar />
      <section className="mx-auto max-w-3xl py-10">
        {isExpired ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/60 dark:bg-amber-950/20">
            <h1 className="text-2xl font-bold tracking-tight text-amber-900 dark:text-amber-200 md:text-3xl">
              This application form has expired
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm text-amber-800 dark:text-amber-300">
              Applications for this role are closed. Better luck next time.
            </p>
            <div className="mt-5 flex justify-center">
              <Link href="/">
                <Button color="light">Back to home</Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
              {job?.title ?? "Apply"}
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{job?.description}</p>

            <form
              onSubmit={onSubmit}
              className="mt-8 space-y-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950"
            >
              <div>
                <Label htmlFor="email">Email</Label>
                <TextInput
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              {job?.formFields.map((field) => (
                <div key={`${field.label}-${field.type}`}>
                  <Label>{field.label}</Label>
                  {field.type === "textarea" ? (
                    <Textarea
                      required={field.required}
                      rows={3}
                      onChange={(event) =>
                        setAnswers((prev) => ({ ...prev, [field.label]: event.target.value }))
                      }
                    />
                  ) : field.type === "select" ? (
                    <Select
                      required={field.required}
                      onChange={(event) =>
                        setAnswers((prev) => ({ ...prev, [field.label]: event.target.value }))
                      }
                    >
                      <option value="">Select</option>
                      {(field.options ?? []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <TextInput
                      type={field.type === "textarea" ? "text" : field.type}
                      required={field.required}
                      onChange={(event) =>
                        setAnswers((prev) => ({ ...prev, [field.label]: event.target.value }))
                      }
                    />
                  )}
                </div>
              ))}

              <div>
                <Label htmlFor="resume">Resume (PDF)</Label>
                <TextInput
                  id="resume"
                  type="file"
                  required
                  accept=".pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setResume(file);
                  }}
                />
              </div>

              {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <Button type="submit">Submit application</Button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

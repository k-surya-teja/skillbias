"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Select, Textarea, TextInput, ToggleSwitch } from "flowbite-react";
import {
  CheckCircle2,
  Filter,
  Loader2,
  Save,
  Search,
  Settings as SettingsIcon,
  TestTube2,
  X,
  XCircle,
} from "lucide-react";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { ApiError, errorMessage } from "@/lib/ats/api";
import { testAiProvider, updateSettings } from "@/lib/ats/settings";
import type {
  AiProvider,
  Organization,
  OrgScoringWeights,
  SettingsUpdate,
} from "@/lib/ats/types";

const DEFAULT_WEIGHTS: OrgScoringWeights = {
  skills: 40,
  experience: 25,
  format: 15,
  answers: 20,
};

type SectionId =
  | "commonly-used"
  | "company-profile"
  | "hiring-automation"
  | "ai-scoring"
  | "new-job-defaults"
  | "account";

type SectionDef = {
  id: SectionId;
  title: string;
};

const SECTIONS: SectionDef[] = [
  { id: "commonly-used", title: "Commonly Used" },
  { id: "company-profile", title: "Company Profile" },
  { id: "hiring-automation", title: "Hiring Automation" },
  { id: "ai-scoring", title: "AI Scoring" },
  { id: "new-job-defaults", title: "New Job Defaults" },
  { id: "account", title: "Account" },
];

const PROVIDER_OPTIONS: Array<{
  id: AiProvider;
  label: string;
  hint: string;
  defaultModel: string;
  needsKey: boolean;
}> = [
  {
    id: "skillbias",
    label: "SkillBias default",
    hint: "Bundled scoring — no key needed.",
    defaultModel: "llama-3.3-70b-versatile",
    needsKey: false,
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    hint: "Use your own Anthropic API key.",
    defaultModel: "claude-sonnet-4-6",
    needsKey: true,
  },
  {
    id: "openai",
    label: "OpenAI",
    hint: "Use your own OpenAI API key.",
    defaultModel: "gpt-4o-mini",
    needsKey: true,
  },
  {
    id: "groq",
    label: "Groq",
    hint: "Use your own Groq API key.",
    defaultModel: "llama-3.3-70b-versatile",
    needsKey: true,
  },
  {
    id: "custom",
    label: "Custom endpoint",
    hint: "Point to your own /score endpoint.",
    defaultModel: "",
    needsKey: false,
  },
];

export default function OrgSettingsPage() {
  const router = useRouter();
  const { organization, isLoaded, setOrganization } = useAuth();
  const toast = useToast();

  const [original, setOriginal] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<SectionId>("commonly-used");

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [autoShortlistEnabled, setAutoShortlistEnabled] = useState(false);
  const [autoShortlistThreshold, setAutoShortlistThreshold] = useState(80);
  const [autoRejectEnabled, setAutoRejectEnabled] = useState(false);
  const [autoRejectThreshold, setAutoRejectThreshold] = useState(30);
  const [weights, setWeights] = useState<OrgScoringWeights>(DEFAULT_WEIGHTS);
  const [defaultJobIsPublic, setDefaultJobIsPublic] = useState(false);

  // AI scoring provider state
  const [aiProvider, setAiProvider] = useState<AiProvider>("skillbias");
  const [aiModel, setAiModel] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiCustomUrl, setAiCustomUrl] = useState("");
  const [aiCustomAuthHeader, setAiCustomAuthHeader] = useState("");
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<
    | { ok: true; latencyMs: number; sampleScore: number; sampleFeedback: string }
    | { ok: false; message: string }
    | null
  >(null);

  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({
    "commonly-used": null,
    "company-profile": null,
    "hiring-automation": null,
    "ai-scoring": null,
    "new-job-defaults": null,
    account: null,
  });
  const scrollRoot = useRef<HTMLDivElement | null>(null);

  // Hydrate form from the org we already have in AuthContext (came in via the
  // login response — no extra network round-trip).
  useEffect(() => {
    if (!isLoaded) return;
    if (!organization) {
      router.replace("/org/login");
      return;
    }
    setOriginal(organization);
    setCompanyName(organization.companyName ?? "");
    setDescription(organization.description ?? "");
    setWebsite(organization.website ?? "");
    setAutoShortlistEnabled(organization.autoShortlistEnabled ?? false);
    setAutoShortlistThreshold(organization.autoShortlistThreshold ?? 80);
    setAutoRejectEnabled(organization.autoRejectEnabled ?? false);
    setAutoRejectThreshold(organization.autoRejectThreshold ?? 30);
    setWeights(organization.defaultScoringWeights ?? DEFAULT_WEIGHTS);
    setDefaultJobIsPublic(organization.defaultJobIsPublic ?? false);
    setAiProvider(organization.aiProvider ?? "skillbias");
    setAiModel(organization.aiModel ?? "");
    setAiCustomUrl(organization.aiCustomUrl ?? "");
    // Secrets are never round-tripped; the inputs stay empty and the placeholder
    // tells the user one is already on file (see *Set booleans below).
    setAiApiKey("");
    setAiCustomAuthHeader("");
    setLoading(false);
  }, [isLoaded, organization, router]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Scroll-spy: highlight section under viewport
  useEffect(() => {
    if (loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.getAttribute("data-section-id") as SectionId | null;
          if (id) setActiveSection(id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [loading, search]);

  function jumpTo(id: SectionId) {
    const el = sectionRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Validation
  const weightsTotal = weights.skills + weights.experience + weights.format + weights.answers;
  const weightsValid = weightsTotal === 100;
  const thresholdsValid =
    !autoShortlistEnabled || !autoRejectEnabled || autoShortlistThreshold > autoRejectThreshold;

  const dirty = useMemo(() => {
    if (!original) return false;
    return (
      (original.companyName ?? "") !== companyName ||
      (original.description ?? "") !== description ||
      (original.website ?? "") !== website ||
      (original.autoShortlistEnabled ?? false) !== autoShortlistEnabled ||
      (original.autoShortlistThreshold ?? 80) !== autoShortlistThreshold ||
      (original.autoRejectEnabled ?? false) !== autoRejectEnabled ||
      (original.autoRejectThreshold ?? 30) !== autoRejectThreshold ||
      JSON.stringify(original.defaultScoringWeights ?? DEFAULT_WEIGHTS) !== JSON.stringify(weights) ||
      (original.defaultJobIsPublic ?? false) !== defaultJobIsPublic ||
      (original.aiProvider ?? "skillbias") !== aiProvider ||
      (original.aiModel ?? "") !== aiModel ||
      (original.aiCustomUrl ?? "") !== aiCustomUrl ||
      // Secrets: any non-empty value typed = dirty (we never round-trip the actual value).
      aiApiKey !== "" ||
      aiCustomAuthHeader !== ""
    );
  }, [
    original,
    companyName,
    description,
    website,
    autoShortlistEnabled,
    autoShortlistThreshold,
    autoRejectEnabled,
    autoRejectThreshold,
    weights,
    defaultJobIsPublic,
    aiProvider,
    aiModel,
    aiApiKey,
    aiCustomUrl,
    aiCustomAuthHeader,
  ]);

  // Build settings registry — single source for sidebar + search + render
  const settings = useMemo(() => {
    const list: Array<{
      key: string;
      section: SectionId;
      label: string;
      sublabel?: string;
      description: string;
      modified: boolean;
      keywords?: string;
      render: () => React.ReactNode;
    }> = [
      // Company profile
      {
        key: "companyName",
        section: "company-profile",
        label: "Profile: Company Name",
        sublabel: "Company name",
        description: "The display name shown on your public job pages and emails.",
        modified: !!original && (original.companyName ?? "") !== companyName,
        render: () => (
          <TextInput
            sizing="md"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        ),
      },
      {
        key: "website",
        section: "company-profile",
        label: "Profile: Website",
        sublabel: "Website URL",
        description: "Linked from your public career page. Must start with http:// or https://.",
        modified: !!original && (original.website ?? "") !== website,
        render: () => (
          <TextInput
            sizing="md"
            placeholder="https://yourcompany.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        ),
      },
      {
        key: "description",
        section: "company-profile",
        label: "Profile: About",
        sublabel: "Short company description",
        description:
          "One short paragraph candidates see on the apply page. Markdown is not rendered.",
        modified: !!original && (original.description ?? "") !== description,
        render: () => (
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="We build…"
          />
        ),
      },

      // Hiring automation
      {
        key: "autoShortlistEnabled",
        section: "hiring-automation",
        label: "Hiring: Auto-shortlist High Scorers",
        sublabel: "Enable auto-shortlist",
        description:
          "When enabled, candidates who score at or above the threshold are moved to Shortlisted automatically after AI scoring completes.",
        modified: !!original && (original.autoShortlistEnabled ?? false) !== autoShortlistEnabled,
        keywords: "auto shortlist threshold ai score",
        render: () => (
          <ToggleSwitch
            checked={autoShortlistEnabled}
            onChange={setAutoShortlistEnabled}
            label={autoShortlistEnabled ? "On" : "Off"}
          />
        ),
      },
      {
        key: "autoShortlistThreshold",
        section: "hiring-automation",
        label: "Hiring: Auto-shortlist Threshold",
        sublabel: "Score ≥ this value triggers shortlist",
        description:
          "Only applies when auto-shortlist is enabled. Must be greater than the auto-reject threshold.",
        modified: !!original && (original.autoShortlistThreshold ?? 80) !== autoShortlistThreshold,
        keywords: "auto shortlist threshold ai score",
        render: () => (
          <SliderControl
            value={autoShortlistThreshold}
            onChange={setAutoShortlistThreshold}
            disabled={!autoShortlistEnabled}
          />
        ),
      },
      {
        key: "autoRejectEnabled",
        section: "hiring-automation",
        label: "Hiring: Auto-reject Low Scorers",
        sublabel: "Enable auto-reject",
        description:
          "When enabled, candidates who score at or below the threshold are moved to Rejected automatically after scoring.",
        modified: !!original && (original.autoRejectEnabled ?? false) !== autoRejectEnabled,
        keywords: "auto reject threshold ai score",
        render: () => (
          <ToggleSwitch
            checked={autoRejectEnabled}
            onChange={setAutoRejectEnabled}
            label={autoRejectEnabled ? "On" : "Off"}
          />
        ),
      },
      {
        key: "autoRejectThreshold",
        section: "hiring-automation",
        label: "Hiring: Auto-reject Threshold",
        sublabel: "Score ≤ this value triggers reject",
        description:
          "Only applies when auto-reject is enabled. Must be lower than the auto-shortlist threshold.",
        modified: !!original && (original.autoRejectThreshold ?? 30) !== autoRejectThreshold,
        keywords: "auto reject threshold ai score",
        render: () => (
          <SliderControl
            value={autoRejectThreshold}
            onChange={setAutoRejectThreshold}
            disabled={!autoRejectEnabled}
          />
        ),
      },

      // AI scoring provider
      {
        key: "aiProvider",
        section: "ai-scoring",
        label: "AI: Scoring Provider",
        sublabel: "Which AI model scores resumes for your jobs",
        description:
          "Bring your own Anthropic / OpenAI / Groq key, or stay on the bundled SkillBias scoring. If your provider fails, we transparently fall back to SkillBias and tag the candidate's feedback.",
        modified: !!original && (original.aiProvider ?? "skillbias") !== aiProvider,
        keywords: "ai provider model anthropic openai groq custom claude chatgpt",
        render: () => (
          <ProviderPicker
            value={aiProvider}
            onChange={(next) => {
              setAiProvider(next);
              setAiTestResult(null);
            }}
          />
        ),
      },
      ...(aiProvider !== "skillbias"
        ? [
            ...(aiProvider !== "custom"
              ? [
                  {
                    key: "aiApiKey",
                    section: "ai-scoring" as SectionId,
                    label: "AI: API Key",
                    sublabel: original?.aiApiKeySet
                      ? "A key is on file — type to replace"
                      : "Your provider's secret key",
                    description:
                      "Stored on the SkillBias backend. We send it only as the auth header to your chosen provider, and never return the value to the browser. Leave blank to keep the existing key.",
                    modified: aiApiKey !== "",
                    keywords: "ai api key token secret authorization",
                    render: () => (
                      <TextInput
                        sizing="md"
                        type="password"
                        autoComplete="off"
                        placeholder={
                          original?.aiApiKeySet
                            ? "•••••••• (saved — type to replace)"
                            : "sk-… or your provider's key format"
                        }
                        value={aiApiKey}
                        onChange={(e) => setAiApiKey(e.target.value)}
                      />
                    ),
                  },
                ]
              : []),
            ...(aiProvider === "custom"
              ? [
                  {
                    key: "aiCustomUrl",
                    section: "ai-scoring" as SectionId,
                    label: "AI: Custom Endpoint URL",
                    sublabel: "POSTed with the scoring payload",
                    description:
                      "Your endpoint receives JSON: { job: {requirements, requiredSkills}, candidate: {resumeMetrics} } and must return { score: 0-100, feedback: string }.",
                    modified: !!original && (original.aiCustomUrl ?? "") !== aiCustomUrl,
                    keywords: "custom url endpoint webhook",
                    render: () => (
                      <TextInput
                        sizing="md"
                        placeholder="https://your-api.example.com/score"
                        value={aiCustomUrl}
                        onChange={(e) => setAiCustomUrl(e.target.value)}
                      />
                    ),
                  },
                  {
                    key: "aiCustomAuthHeader",
                    section: "ai-scoring" as SectionId,
                    label: "AI: Custom Authorization Header",
                    sublabel: original?.aiCustomAuthHeaderSet
                      ? "A header is on file — type to replace"
                      : "Sent as `Authorization: <value>`",
                    description:
                      "Optional. Paste exactly what you want in the header — e.g. `Bearer abc123` or `ApiKey xyz`. Leave blank to keep the existing value.",
                    modified: aiCustomAuthHeader !== "",
                    keywords: "custom auth header bearer api key",
                    render: () => (
                      <TextInput
                        sizing="md"
                        type="password"
                        autoComplete="off"
                        placeholder={
                          original?.aiCustomAuthHeaderSet
                            ? "•••••••• (saved — type to replace)"
                            : "Bearer your-token"
                        }
                        value={aiCustomAuthHeader}
                        onChange={(e) => setAiCustomAuthHeader(e.target.value)}
                      />
                    ),
                  },
                ]
              : []),
            {
              key: "aiTest",
              section: "ai-scoring" as SectionId,
              label: "AI: Test Connection",
              sublabel: "Run a sample scoring request",
              description:
                "Sends a canned candidate + JD to your configured provider and shows the score, the feedback, and the round-trip time. Errors surface the provider's actual message.",
              modified: false,
              keywords: "test connection ping verify",
              render: () => (
                <TestProviderButton
                  testing={aiTesting}
                  result={aiTestResult}
                  onTest={handleTestAi}
                />
              ),
            },
          ]
        : []),

      // New job defaults
      {
        key: "defaultScoringWeights",
        section: "new-job-defaults",
        label: "Scoring: Default Weights",
        sublabel: "How AI scoring is balanced for new jobs",
        description:
          "Per-job overrides still win. The four weights must sum to 100. Higher skill weight rewards candidates whose resume matches required skills.",
        modified:
          !!original &&
          JSON.stringify(original.defaultScoringWeights ?? DEFAULT_WEIGHTS) !== JSON.stringify(weights),
        keywords: "scoring weights skills experience format answers",
        render: () => (
          <WeightsControl
            weights={weights}
            onChange={(next) => setWeights(next)}
            total={weightsTotal}
            valid={weightsValid}
          />
        ),
      },
      {
        key: "defaultJobIsPublic",
        section: "new-job-defaults",
        label: "Visibility: Default New Jobs to Public",
        sublabel: "List on the public board by default",
        description:
          "When off, new roles are unlisted unless you opt in per role at creation time.",
        modified: !!original && (original.defaultJobIsPublic ?? false) !== defaultJobIsPublic,
        keywords: "public visibility default board",
        render: () => (
          <ToggleSwitch
            checked={defaultJobIsPublic}
            onChange={setDefaultJobIsPublic}
            label={defaultJobIsPublic ? "Public" : "Unlisted"}
          />
        ),
      },

      // Account
      {
        key: "email",
        section: "account",
        label: "Account: Login Email",
        sublabel: "Read-only",
        description: "The email used to sign in to your organization.",
        modified: false,
        render: () => (
          <TextInput readOnly disabled value={original?.email ?? ""} sizing="md" />
        ),
      },
      {
        key: "plan",
        section: "account",
        label: "Account: Subscription Plan",
        sublabel: "Read-only",
        description: "Your current SkillBias plan.",
        modified: false,
        render: () => (
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold uppercase text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {original?.plan ?? "free"}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {original?.freeJobUsed ? "Free job credit used" : "Free job credit available"}
            </span>
          </div>
        ),
      },
    ];

    return list;
  }, [
    original,
    companyName,
    website,
    description,
    autoShortlistEnabled,
    autoShortlistThreshold,
    autoRejectEnabled,
    autoRejectThreshold,
    weights,
    defaultJobIsPublic,
    weightsTotal,
    weightsValid,
    aiProvider,
    aiModel,
    aiApiKey,
    aiCustomUrl,
    aiCustomAuthHeader,
    aiTesting,
    aiTestResult,
  ]);

  const filteredSettings = useMemo(() => {
    if (!search) return settings;
    return settings.filter((s) =>
      `${s.label} ${s.sublabel ?? ""} ${s.description} ${s.keywords ?? ""}`
        .toLowerCase()
        .includes(search),
    );
  }, [settings, search]);

  // Curate "Commonly Used"
  const commonlyUsedKeys = new Set([
    "autoShortlistEnabled",
    "autoShortlistThreshold",
    "defaultScoringWeights",
    "companyName",
    "defaultJobIsPublic",
  ]);

  function settingsForSection(id: SectionId) {
    if (id === "commonly-used") {
      return filteredSettings.filter((s) => commonlyUsedKeys.has(s.key));
    }
    return filteredSettings.filter((s) => s.section === id);
  }

  const visibleSections = SECTIONS.filter((s) => settingsForSection(s.id).length > 0);

  async function handleSave() {
    if (!weightsValid) {
      toast.error("Scoring weights must total 100");
      return;
    }
    if (!thresholdsValid) {
      toast.error("Auto-shortlist threshold must be greater than auto-reject threshold");
      return;
    }
    setSaving(true);
    try {
      const payload: SettingsUpdate = {
        companyName: companyName.trim(),
        description: description.trim(),
        website: website.trim(),
        autoShortlistEnabled,
        autoShortlistThreshold,
        autoRejectEnabled,
        autoRejectThreshold,
        defaultScoringWeights: weights,
        defaultJobIsPublic,
        aiProvider,
        aiModel: aiModel.trim(),
        aiApiKey: aiApiKey.trim(),
        aiCustomUrl: aiCustomUrl.trim(),
        aiCustomAuthHeader: aiCustomAuthHeader.trim(),
      };
      const { organization: org } = await updateSettings(payload);
      setOriginal(org);
      // Push the fresh org into AuthContext so other pages (and any future
      // navigation away/back) see the updated settings without a refetch.
      setOrganization(org);
      // Reset secret inputs so the placeholder reflects the new "saved" state.
      setAiApiKey("");
      setAiCustomAuthHeader("");
      toast.success("Settings saved");
    } catch (saveError) {
      const msg = errorMessage(saveError, "Failed to save settings");
      toast.error(msg);
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestAi() {
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const result = await testAiProvider({
        provider: aiProvider,
        model: aiModel.trim() || undefined,
        apiKey: aiApiKey.trim() || undefined,
        customUrl: aiCustomUrl.trim() || undefined,
        customAuthHeader: aiCustomAuthHeader.trim() || undefined,
      });
      setAiTestResult({
        ok: true,
        latencyMs: result.latencyMs,
        sampleScore: result.sampleScore,
        sampleFeedback: result.sampleFeedback,
      });
    } catch (testErr) {
      // ApiError carries the provider's original message in its `message`
      // (already prefixed with "<Provider> returned an error: ..." server-side).
      const msg =
        testErr instanceof ApiError
          ? testErr.message
          : errorMessage(testErr, "Provider test failed");
      setAiTestResult({ ok: false, message: msg });
    } finally {
      setAiTesting(false);
    }
  }

  function clearSearch() {
    setSearchInput("");
  }

  if (loading) {
    return (
      <OrgPageShell>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
        </div>
      </OrgPageShell>
    );
  }

  return (
    <OrgPageShell>
      <div className="-mt-4 flex h-[calc(100vh-65px-1rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 md:-mt-8">
        {/* Top bar */}
        <header className="border-b border-gray-200 px-4 pt-3 pb-3 dark:border-gray-800">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
            <SettingsIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            Settings
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search settings"
              className="w-full rounded-md border border-gray-300 bg-gray-50 py-2 pl-9 pr-20 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {searchInput && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                aria-label="Filter"
              >
                <Filter className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </header>

        {error && (
          <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {/* Body: sidebar + scroll panel */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <nav className="hidden w-56 shrink-0 overflow-y-auto border-r border-gray-200 py-3 dark:border-gray-800 md:block">
            <ul className="space-y-0.5 px-2">
              {visibleSections.map((section) => {
                const count = settingsForSection(section.id).length;
                const active = activeSection === section.id;
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => jumpTo(section.id)}
                      className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-sm transition-colors ${
                        active
                          ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                          : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900"
                      }`}
                    >
                      <span>{section.title}</span>
                      <span
                        className={`text-[10px] tabular-nums ${
                          active
                            ? "text-indigo-600 dark:text-indigo-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })}
              {visibleSections.length === 0 && (
                <li className="px-2.5 py-2 text-xs text-gray-400">No matches</li>
              )}
            </ul>
          </nav>

          {/* Right pane */}
          <div ref={scrollRoot} className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6">
            {visibleSections.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Search className="h-8 w-8 text-gray-300 dark:text-gray-700" />
                <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
                  No settings match &ldquo;{search}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={clearSearch}
                  className="mt-2 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Clear search
                </button>
              </div>
            ) : (
              visibleSections.map((section) => {
                const items = settingsForSection(section.id);
                return (
                  <section
                    key={section.id}
                    data-section-id={section.id}
                    ref={(el) => {
                      sectionRefs.current[section.id] = el;
                    }}
                    className="mb-8 scroll-mt-4"
                  >
                    <h2 className="mb-4 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                      {section.title}
                    </h2>
                    <div className="space-y-5">
                      {items.map((item) => (
                        <SettingRow key={item.key} item={item} />
                      ))}
                    </div>
                  </section>
                );
              })
            )}

            {/* Cross-rule warning */}
            {!thresholdsValid && (
              <div className="mb-6 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
                Auto-shortlist threshold ({autoShortlistThreshold}) must be greater than
                auto-reject threshold ({autoRejectThreshold}).
              </div>
            )}
          </div>
        </div>

        {/* Footer save bar */}
        <footer className="flex items-center justify-between gap-3 border-t border-gray-200 bg-white/95 px-4 py-2 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {dirty ? (
              <span className="text-amber-600 dark:text-amber-400">
                ● You have unsaved changes
              </span>
            ) : (
              "All changes saved"
            )}
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving || !weightsValid || !thresholdsValid}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save
              </>
            )}
          </button>
        </footer>
      </div>
    </OrgPageShell>
  );
}

function SettingRow({
  item,
}: {
  item: {
    label: string;
    sublabel?: string;
    description: string;
    modified: boolean;
    render: () => React.ReactNode;
  };
}) {
  const labelParts = item.label.split(":");
  const category = labelParts.length > 1 ? labelParts[0] : null;
  const name = labelParts.length > 1 ? labelParts.slice(1).join(":").trim() : item.label;

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        item.modified
          ? "border-indigo-200 bg-indigo-50/40 dark:border-indigo-900/60 dark:bg-indigo-950/20"
          : "border-transparent"
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        {category && (
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {category}:
          </span>
        )}
        <span className="text-sm font-bold text-gray-900 dark:text-white">{name}</span>
        {item.modified && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-indigo-300 bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
            title="Unsaved change"
          >
            modified
          </span>
        )}
      </div>
      <p className="mb-2 max-w-3xl text-xs text-gray-600 dark:text-gray-400">
        {item.description}
      </p>
      <div className="max-w-xl">{item.render()}</div>
    </div>
  );
}

function SliderControl({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 ${
        disabled ? "pointer-events-none opacity-40" : ""
      }`}
    >
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-600"
      />
      <input
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
        className="w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      />
      <span className="text-xs text-gray-500 dark:text-gray-400">/ 100</span>
    </div>
  );
}

function WeightsControl({
  weights,
  onChange,
  total,
  valid,
}: {
  weights: OrgScoringWeights;
  onChange: (next: OrgScoringWeights) => void;
  total: number;
  valid: boolean;
}) {
  const KEYS: Array<{ key: keyof OrgScoringWeights; label: string }> = [
    { key: "skills", label: "Skills match" },
    { key: "experience", label: "Experience" },
    { key: "format", label: "Resume format" },
    { key: "answers", label: "Application answers" },
  ];
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {KEYS.map(({ key, label }) => (
          <div
            key={key}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-gray-700 dark:text-gray-200">{label}</span>
              <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                {weights[key]}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={weights[key]}
              onChange={(e) =>
                onChange({ ...weights, [key]: Math.max(0, Math.min(100, Number(e.target.value))) })
              }
              className="w-full accent-indigo-600"
            />
          </div>
        ))}
      </div>
      <p
        className={`text-[11px] tabular-nums ${
          valid
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400"
        }`}
      >
        Total: {total}/100 {valid ? "✓" : "(must equal 100)"}
      </p>
    </div>
  );
}

function ProviderPicker({
  value,
  onChange,
}: {
  value: AiProvider;
  onChange: (next: AiProvider) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {PROVIDER_OPTIONS.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              selected
                ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300 dark:border-indigo-600 dark:bg-indigo-950/40 dark:ring-indigo-700"
                : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-indigo-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {opt.label}
              </span>
              {selected && (
                <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                  Active
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{opt.hint}</p>
            {opt.defaultModel && (
              <p className="mt-1 truncate text-[10px] text-gray-400 dark:text-gray-500">
                Default: {opt.defaultModel}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function TestProviderButton({
  testing,
  result,
  onTest,
}: {
  testing: boolean;
  result:
    | { ok: true; latencyMs: number; sampleScore: number; sampleFeedback: string }
    | { ok: false; message: string }
    | null;
  onTest: () => void;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onTest}
        disabled={testing}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900"
      >
        {testing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Testing…
          </>
        ) : (
          <>
            <TestTube2 className="h-4 w-4" /> Test connection
          </>
        )}
      </button>

      {result?.ok === true && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-semibold">
              Connected · sample score {result.sampleScore}/100
            </span>
            <span className="ml-auto text-[11px] text-emerald-600 dark:text-emerald-400">
              {result.latencyMs} ms
            </span>
          </div>
          <p className="mt-1.5 line-clamp-3 text-xs text-emerald-800 dark:text-emerald-200">
            {result.sampleFeedback}
          </p>
        </div>
      )}

      {result?.ok === false && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-900 dark:bg-rose-950/30">
          <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
            <XCircle className="h-4 w-4" />
            <span className="font-semibold">Test failed</span>
          </div>
          <p className="mt-1.5 break-words text-xs text-rose-800 dark:text-rose-200">
            {result.message}
          </p>
        </div>
      )}
    </div>
  );
}

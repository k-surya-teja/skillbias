import Link from "next/link";

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Resume Check", href: "/resume-check" },
      { label: "For Companies", href: "/org/entry" },
      { label: "How it works", href: "/" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/" },
      { label: "Contact", href: "/" },
      { label: "Careers", href: "/" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/" },
      { label: "Terms", href: "/" },
      { label: "Security", href: "/" },
    ],
  },
  {
    title: "Social",
    links: [
      { label: "LinkedIn", href: "/" },
      { label: "X", href: "/" },
      { label: "GitHub", href: "/" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative w-full overflow-hidden border-t border-indigo-200/60 bg-gradient-to-b from-white via-indigo-50/40 to-white px-6 py-12 dark:border-indigo-900/60 dark:from-gray-950 dark:via-indigo-950/20 dark:to-gray-950">
      <div className="pointer-events-none absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:60px_60px] dark:opacity-20 dark:bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)]" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {footerColumns.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-2">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 transition hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-indigo-200/70 pt-6 dark:border-indigo-900/60">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Built for people tired of rejection emails.
          </p>
        </div>
      </div>
    </footer>
  );
}

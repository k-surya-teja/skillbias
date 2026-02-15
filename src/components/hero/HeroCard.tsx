"use client";

import Link from "next/link";
import { Button } from "flowbite-react";
import { FileText, Building2 } from "lucide-react";

export type HeroCardData = {
  title: string;
  description: string;
  buttonText: string;
  href: string;
  icon: "resume" | "company";
};

export function HeroCard({
  title,
  description,
  buttonText,
  href,
  icon,
}: HeroCardData) {
  const Icon = icon === "resume" ? FileText : Building2;

  return (
    <div
      className="
      w-full
      max-w-[420px]
      sm:w-[420px]
      md:w-[440px]
      lg:w-[480px]
      rounded-2xl
      border border-gray-200 dark:border-gray-800
      bg-white dark:bg-gray-950
      p-5 md:p-6
      hover:shadow-xl
      transition
      "
    >
      <Icon className="h-8 w-8 mb-4 text-black dark:text-white" />

      <h3 className="text-xl font-semibold mb-2">{title}</h3>

      <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        {description}
      </p>

      <Link href={href}>
        <Button className="w-full">{buttonText}</Button>
      </Link>
    </div>
  );
}

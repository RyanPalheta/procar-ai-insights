import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata um valor monetário em dólar americano (USD).
 * Pro Car opera nos EUA, então todos os valores do dashboard são em USD.
 * Ex.: formatUSD(1234.5) => "$1,234.50" | formatUSD(1234, 0) => "$1,234"
 */
export function formatUSD(value: number, fractionDigits = 2): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

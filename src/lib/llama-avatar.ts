import llama1 from '@/assets/llamas/llama-1.svg'
import llama2 from '@/assets/llamas/llama-2.svg'
import llama3 from '@/assets/llamas/llama-3.svg'
import llama4 from '@/assets/llamas/llama-4.svg'
import llama5 from '@/assets/llamas/llama-5.svg'
import llama6 from '@/assets/llamas/llama-6.svg'

const LLAMAS = [llama1, llama2, llama3, llama4, llama5, llama6]

/**
 * Returns a deterministic-but-shuffled llama SVG URL for the given month.
 * Same month+year always returns the same llama; different months get different ones.
 */
export function getLlamaForMonth(year: number, month: number): string {
  // Simple hash so the sequence feels random across months
  const seed = year * 12 + month
  return LLAMAS[seed % LLAMAS.length]
}

/** Llama for the current month. */
export function getCurrentLlama(): string {
  const now = new Date()
  return getLlamaForMonth(now.getFullYear(), now.getMonth())
}

/**
 * ARK creature ID utilities.
 *
 * Each creature has two 32-bit unsigned integers (DinoID1, DinoID2) that together
 * form a unique 64-bit ARK ID: (DinoID1 × 2^32) + DinoID2.
 * This is stored as a decimal string because it exceeds Number.MAX_SAFE_INTEGER.
 */

/**
 * Compute the combined 64-bit ARK ID from two 32-bit halves.
 * Result is a decimal string (e.g. "1594784657208257995").
 */
export function combineArkId(id1: number, id2: number): string {
  return (BigInt(id1) * BigInt(4294967296) + BigInt(id2 >>> 0)).toString()
}

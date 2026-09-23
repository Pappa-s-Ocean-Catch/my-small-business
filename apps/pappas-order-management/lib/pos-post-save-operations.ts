type Operation = () => Promise<void>;

export async function runPosPostSaveMutations(operations: {
  coupon?: Operation;
  rewards?: Operation;
}): Promise<string[]> {
  const tasks = [operations.coupon, operations.rewards].filter((task): task is Operation => Boolean(task));
  const results = await Promise.allSettled(tasks.map((task) => task()));
  return results.flatMap((result) => result.status === 'rejected'
    ? [result.reason instanceof Error ? result.reason.message : String(result.reason)]
    : []);
}

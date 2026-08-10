export type ResolverAddonChoice = {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  extraPrice: number;
};

export type ResolverAddonGroup = {
  id: string;
  name: string;
  items: Array<Pick<ResolverAddonChoice, 'id' | 'name' | 'extraPrice'>>;
};

export function groupResolverAddonTargets(targets: ResolverAddonChoice[]): ResolverAddonGroup[] {
  const groups = new Map<string, ResolverAddonGroup>();
  targets.forEach((target) => {
    const group = groups.get(target.groupId) ?? {
      id: target.groupId,
      name: target.groupName,
      items: [],
    };
    group.items.push({ id: target.id, name: target.name, extraPrice: target.extraPrice });
    groups.set(target.groupId, group);
  });
  return Array.from(groups.values());
}

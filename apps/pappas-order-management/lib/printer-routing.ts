import type { Order } from '@my-small-business/types';
import { buildKitchenReceiptCopies, DEFAULT_KITCHEN_SECTION } from '@/utils/orderUtils';
import type { SavedPrinter } from './escpos-printer';
import type { AppSettings, PrinterSectionAssignment } from './settings';

type OrderItem = NonNullable<Order['items']>[number];

export type SectionPrintTicket = ReturnType<typeof buildKitchenReceiptCopies<OrderItem>>[number];

const DEFAULT_ASSIGNMENT_NAME = 'default';

export function normalizeSectionAssignmentName(value?: string | null): string {
  const normalized = value?.trim().toLowerCase();
  return normalized || DEFAULT_ASSIGNMENT_NAME;
}

export function isDefaultPrinterAssignment(assignment: Pick<PrinterSectionAssignment, 'isDefault' | 'sectionName'>): boolean {
  return !!assignment.isDefault || normalizeSectionAssignmentName(assignment.sectionName) === DEFAULT_ASSIGNMENT_NAME;
}

export function getDefaultPrinterAssignment(settings: Pick<AppSettings, 'printerSectionAssignments' | 'printerSelectedTarget'>): PrinterSectionAssignment | null {
  return settings.printerSectionAssignments.find((assignment) => isDefaultPrinterAssignment(assignment)) || (
    settings.printerSelectedTarget
      ? {
          id: 'legacy-default-printer',
          sectionName: 'Default',
          printerTarget: settings.printerSelectedTarget,
          useSimulator: false,
          isDefault: true,
        }
      : null
  );
}

export function getPrinterAssignmentForSection(
  settings: Pick<AppSettings, 'printerSectionAssignments' | 'printerSelectedTarget'>,
  sectionName?: string | null
): PrinterSectionAssignment | null {
  const normalizedSection = normalizeSectionAssignmentName(sectionName || DEFAULT_KITCHEN_SECTION);
  return settings.printerSectionAssignments.find(
    (assignment) => !isDefaultPrinterAssignment(assignment) && normalizeSectionAssignmentName(assignment.sectionName) === normalizedSection
  ) || getDefaultPrinterAssignment(settings);
}

export function shouldSkipPrintForSection(
  settings: Pick<AppSettings, 'printerSectionAssignments' | 'printerSelectedTarget' | 'printerSimulator'>,
  sectionName?: string | null
): boolean {
  if (settings.printerSimulator) return false;
  const assignment = getPrinterAssignmentForSection(settings, sectionName);
  if (!assignment) return false;
  return !assignment.useSimulator && !assignment.printerTarget;
}

export function resolvePrinterForSection(
  settings: Pick<AppSettings, 'printerSaved' | 'printerSectionAssignments' | 'printerSelectedTarget'>,
  sectionName?: string | null
): SavedPrinter | null {
  const assignment = getPrinterAssignmentForSection(settings, sectionName);
  const printerTarget = assignment?.printerTarget || (
    assignment ? null : settings.printerSelectedTarget
  );

  if (!printerTarget) return null;
  return settings.printerSaved.find((printer) => printer.target === printerTarget) || null;
}

export function shouldUseSimulatorForSection(
  settings: Pick<AppSettings, 'printerSectionAssignments' | 'printerSelectedTarget'>,
  sectionName?: string | null
): boolean {
  return !!getPrinterAssignmentForSection(settings, sectionName)?.useSimulator;
}

export function hasAnySimulatorAssignment(
  settings: Pick<AppSettings, 'printerSectionAssignments' | 'printerSimulator'>
): boolean {
  return !!settings.printerSimulator || settings.printerSectionAssignments.some((assignment) => !!assignment.useSimulator);
}

export function getSectionRoutingDebugLabel(
  settings: Pick<AppSettings, 'printerSaved' | 'printerSectionAssignments' | 'printerSelectedTarget' | 'printerSimulator'>,
  sectionName?: string | null
): string {
  const assignment = getPrinterAssignmentForSection(settings, sectionName);
  const resolvedSection = sectionName || assignment?.sectionName || 'Default';
  if (shouldSkipPrintForSection(settings, sectionName)) {
    return `${resolvedSection} -> Skipped`;
  }
  if (settings.printerSimulator || assignment?.useSimulator) {
    return `${resolvedSection} -> Simulator`;
  }
  const printer = resolvePrinterForSection(settings, sectionName);
  return `${resolvedSection} -> ${printer?.deviceName || 'No printer'}`;
}

export function getSectionPrintTickets(order: Pick<Order, 'items'>): SectionPrintTicket[] {
  return buildKitchenReceiptCopies(order.items || []);
}

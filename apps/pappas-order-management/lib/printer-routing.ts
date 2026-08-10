import type { Order } from '@my-small-business/types';
import {
  buildKitchenReceiptCopies,
  CUSTOMER_COPY_SECTION,
  DEFAULT_KITCHEN_SECTION,
  shouldSkipOverlappingCombinedSectionTicket,
} from '@/utils/orderUtils';
import { getPrinterDriver, isSimulatorPrinterTarget, type SavedPrinter } from './escpos-printer';
import type { AppSettings, PrinterSectionAssignment } from './settings';

type OrderItem = NonNullable<Order['items']>[number];

export type SectionPrintTicket = ReturnType<typeof buildKitchenReceiptCopies<OrderItem>>[number];

const DEFAULT_ASSIGNMENT_NAME = 'default';

function parseTimeMinutes(value?: string | null): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hoursText, minutesText] = value.split(':');
  const hours = Number.parseInt(hoursText, 10);
  const minutes = Number.parseInt(minutesText, 10);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return (hours * 60) + minutes;
}

export function isAssignmentEnabledAtTime(
  assignment: Pick<PrinterSectionAssignment, 'enabledFromTime' | 'enabledToTime'>,
  now: Date = new Date()
): boolean {
  const fromMinutes = parseTimeMinutes(assignment.enabledFromTime);
  const toMinutes = parseTimeMinutes(assignment.enabledToTime);
  if (fromMinutes == null || toMinutes == null) return true;

  const nowMinutes = (now.getHours() * 60) + now.getMinutes();
  if (fromMinutes === toMinutes) return true;
  if (fromMinutes < toMinutes) {
    return nowMinutes >= fromMinutes && nowMinutes < toMinutes;
  }
  return nowMinutes >= fromMinutes || nowMinutes < toMinutes;
}

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
          printMode: 'combine',
          template: 'kitchen',
          enabledFromTime: null,
          enabledToTime: null,
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
  settings: Pick<AppSettings, 'printerSectionAssignments' | 'printerSelectedTarget'>,
  sectionName?: string | null
): boolean {
  const assignment = getPrinterAssignmentForSection(settings, sectionName);
  if (!assignment) return false;
  return !assignment.printerTarget || !isAssignmentEnabledAtTime(assignment);
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

export function hasAnySimulatorAssignment(
  settings: Pick<AppSettings, 'printerSectionAssignments'>
): boolean {
  return settings.printerSectionAssignments.some((assignment) => isSimulatorPrinterTarget(assignment.printerTarget));
}

export function getSectionRoutingDebugLabel(
  settings: Pick<AppSettings, 'printerSaved' | 'printerSectionAssignments' | 'printerSelectedTarget'>,
  sectionName?: string | null
): string {
  const assignment = getPrinterAssignmentForSection(settings, sectionName);
  const resolvedSection = sectionName || assignment?.sectionName || 'Default';
  if (shouldSkipPrintForSection(settings, sectionName)) {
    return `${resolvedSection} -> Skipped`;
  }
  const printer = resolvePrinterForSection(settings, sectionName);
  if (printer && getPrinterDriver(printer) === 'simulator') {
    return `${resolvedSection} -> Simulator`;
  }
  return `${resolvedSection} -> ${printer?.deviceName || 'No printer'}`;
}

export function getSectionPrintTickets(order: Pick<Order, 'items'>): SectionPrintTicket[] {
  return buildKitchenReceiptCopies(order.items || []);
}

export type ResolvedSectionPrintJob = {
  key: string;
  assignmentId: string;
  sectionName: string | null;
  printer: SavedPrinter | null;
  printMode: 'combine' | 'separate';
  template: 'kitchen' | 'customer-copy';
  duplicateBySections: boolean;
  onlyTicketIndex?: number;
  label: string;
};

export function buildSectionPrintJobs(
  settings: Pick<AppSettings, 'printerSaved' | 'printerSectionAssignments' | 'printerSelectedTarget'>,
  order: Pick<Order, 'items'>
): ResolvedSectionPrintJob[] {
  const tickets = getSectionPrintTickets(order);
  const ticketSectionNames = tickets.map((ticket) => ticket.sections[0]?.sectionName || null);
  const jobs: ResolvedSectionPrintJob[] = [];
  const seenCombinedKeys = new Set<string>();
  const specialAssignments = settings.printerSectionAssignments.filter((assignment) => (
    !isDefaultPrinterAssignment(assignment)
    && normalizeSectionAssignmentName(assignment.sectionName) === normalizeSectionAssignmentName(CUSTOMER_COPY_SECTION)
    && !!assignment.printerTarget
    && isAssignmentEnabledAtTime(assignment)
  ));

  tickets.forEach((ticket, index) => {
    const sectionName = ticket.sections[0]?.sectionName || null;
    if (shouldSkipOverlappingCombinedSectionTicket(sectionName, ticketSectionNames)) {
      return;
    }
    if (shouldSkipPrintForSection(settings, sectionName)) {
      return;
    }

    const assignment = getPrinterAssignmentForSection(settings, sectionName);
    const printMode = assignment?.printMode === 'separate' ? 'separate' : 'combine';
    const template = assignment?.template === 'customer-copy' ? 'customer-copy' : 'kitchen';
    const printer = resolvePrinterForSection(settings, sectionName);
    const label = getSectionRoutingDebugLabel(settings, sectionName);

    if (printMode === 'combine') {
      const combinedKey = `${assignment?.id || 'default'}:${printer?.target || 'printer'}`;
      if (seenCombinedKeys.has(combinedKey)) {
        return;
      }
      seenCombinedKeys.add(combinedKey);
      jobs.push({
        key: combinedKey,
        assignmentId: assignment?.id || 'default',
        sectionName,
        printer,
        printMode,
        template,
        duplicateBySections: false,
        label,
      });
      return;
    }

    jobs.push({
      key: `${assignment?.id || 'default'}:${ticket.key}`,
      assignmentId: assignment?.id || 'default',
      sectionName,
      printer,
      printMode,
      template,
      duplicateBySections: true,
      onlyTicketIndex: index,
      label,
    });
  });

  specialAssignments.forEach((assignment) => {
    const printer = resolvePrinterForSection(settings, assignment.sectionName);
    jobs.push({
      key: `${assignment.id}:customer-copy`,
      assignmentId: assignment.id,
      sectionName: assignment.sectionName,
      printer,
      printMode: 'combine',
      template: assignment.template === 'customer-copy' ? 'customer-copy' : 'kitchen',
      duplicateBySections: false,
      label: getSectionRoutingDebugLabel(settings, assignment.sectionName),
    });
  });

  return jobs;
}

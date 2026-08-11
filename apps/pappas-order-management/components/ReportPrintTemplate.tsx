import { StyleSheet, Text, View } from 'react-native';
import { REPORT_RECEIPT_WIDTH, type ReportPrintSnapshot } from '@/lib/report-printing';

const money = (value: number) => `$${Math.round(value).toLocaleString('en-AU')}`;
const nullableMoney = (value: number | null) => value == null ? 'N/A' : money(value);

function Divider() {
  return <View style={styles.divider} />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DataRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabelWrap}>
        <Text style={styles.rowLabel}>{label}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function ReportPrintTemplate({ snapshot, storeName }: {
  snapshot: ReportPrintSnapshot;
  storeName: string;
}) {
  return (
    <View style={styles.receipt}>
      <Text style={styles.storeName}>{storeName}</Text>
      <Text style={styles.title}>{snapshot.reportLabel}</Text>
      <Text style={styles.period}>{snapshot.periodLabel}</Text>
      <Text style={styles.generatedAt}>Printed {snapshot.generatedAt}</Text>

      <Divider />

      <Section title="Summary">
        <DataRow label="Gross sales" value={money(snapshot.summary.grossSales)} />
        <DataRow label="Paid orders" value={String(snapshot.summary.paidOrders)} />
        <DataRow label="Average order" value={money(snapshot.summary.averageOrder)} />
        <DataRow label="Discounts" value={money(snapshot.summary.discounts)} />
      </Section>

      {snapshot.salesByDate ? (
        <>
          <Divider />
          <Section title="Gross sales by date">
            {snapshot.salesByDate.length ? snapshot.salesByDate.map((row) => (
              <DataRow key={row.label} label={row.label} value={money(row.total)} />
            )) : <Text style={styles.emptyText}>No paid sales for this period.</Text>}
          </Section>
        </>
      ) : null}

      <Divider />
      <Section title="Payment method">
        {snapshot.paymentBreakdown.length ? snapshot.paymentBreakdown.map((row) => (
          <DataRow key={row.label} label={row.label} detail={`${row.orders} orders`} value={money(row.total)} />
        )) : <Text style={styles.emptyText}>No paid sales for this period.</Text>}
      </Section>

      <Divider />
      <Section title="Channel">
        {snapshot.channelBreakdown.length ? snapshot.channelBreakdown.map((row) => (
          <DataRow key={row.label} label={row.label} detail={`${row.orders} orders`} value={money(row.total)} />
        )) : <Text style={styles.emptyText}>No paid sales for this period.</Text>}
      </Section>

      <Divider />
      <Section title="Channel financials">
        {snapshot.channelFinancials.map((row) => (
          <View key={row.label} style={styles.financialBlock}>
            <Text style={styles.financialHeading}>{row.label} · {row.orders} orders</Text>
            <DataRow label="Gross sales" value={money(row.grossSales)} />
            <DataRow label="Gross payout" value={nullableMoney(row.grossPayout)} />
            <DataRow label="Commission" value={nullableMoney(row.commission)} />
            <DataRow label="Net sales" value={nullableMoney(row.netSales)} />
          </View>
        ))}
      </Section>

      <Divider />
      <Text style={styles.footer}>End of report</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  receipt: { width: REPORT_RECEIPT_WIDTH, backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 22 },
  storeName: { color: '#000', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  title: { color: '#000', fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  period: { color: '#000', fontSize: 17, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  generatedAt: { color: '#333', fontSize: 14, textAlign: 'center', marginTop: 5 },
  divider: { borderTopWidth: 1, borderTopColor: '#000', borderStyle: 'dashed', marginVertical: 15 },
  section: { gap: 8 },
  sectionTitle: { color: '#000', fontSize: 19, fontWeight: '800', textTransform: 'uppercase', marginBottom: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  rowLabelWrap: { flex: 1 },
  rowLabel: { color: '#000', fontSize: 17, fontWeight: '600' },
  rowDetail: { color: '#333', fontSize: 14, marginTop: 1 },
  rowValue: { color: '#000', fontSize: 17, fontWeight: '800', textAlign: 'right' },
  financialBlock: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#777', gap: 6, paddingTop: 10, marginTop: 3 },
  financialHeading: { color: '#000', fontSize: 17, fontWeight: '800' },
  emptyText: { color: '#333', fontSize: 16 },
  footer: { color: '#333', fontSize: 14, textAlign: 'center' },
});
